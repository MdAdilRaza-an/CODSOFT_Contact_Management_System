const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");
const app = require("../src/app");
const pool = require("../src/config/db");
const service = require("../src/services/contact.service");

let server;
let baseUrl;

test("health endpoint preserves its existing response contract", async () => {
  const response = await request("/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: "Contact Management API is running"
  });
});

test("package entry point resolves to the Express application", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  const entryPoint = path.join(__dirname, "..", packageJson.main);

  assert.equal(fs.existsSync(entryPoint), true);
  assert.equal(require(entryPoint), app);
});

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function request(path, options) {
  const response = await fetch(new URL(path, baseUrl), options);
  return {
    status: response.status,
    body: await response.json()
  };
}

test("contact ID routes reject invalid and unsafe IDs before service access", async (t) => {
  let serviceCalls = 0;
  t.mock.method(service, "getContactById", async () => {
    serviceCalls += 1;
    return null;
  });
  t.mock.method(service, "updateContact", async () => {
    serviceCalls += 1;
    return null;
  });
  t.mock.method(service, "deleteContact", async () => {
    serviceCalls += 1;
    return false;
  });

  for (const id of [
    "0",
    "-1",
    "1.5",
    "not-a-number",
    "9007199254740992",
    "1%0A"
  ]) {
    const responses = await Promise.all([
      request(`/api/contacts/${id}`),
      request(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Ada" })
      }),
      request(`/api/contacts/${id}`, { method: "DELETE" })
    ]);

    assert.deepEqual(responses.map(({ status }) => status), [400, 400, 400]);
  }

  assert.equal(serviceCalls, 0);
});

test("valid IDs that do not exist preserve the not-found responses", async (t) => {
  t.mock.method(service, "getContactById", async () => null);
  t.mock.method(service, "updateContact", async () => null);
  t.mock.method(service, "deleteContact", async () => false);

  const responses = await Promise.all([
    request("/api/contacts/123"),
    request("/api/contacts/123", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada" })
    }),
    request("/api/contacts/123", { method: "DELETE" })
  ]);

  assert.deepEqual(responses.map(({ status }) => status), [404, 404, 404]);
});

test("valid contact operations preserve the current response and list contract", async (t) => {
  const contact = {
    id: 8,
    name: "Ada",
    email: "ada@example.com",
    phone: "+1 (415) 555-0100"
  };
  let listArguments;
  t.mock.method(service, "getContactById", async () => contact);
  t.mock.method(service, "listContacts", async (args) => {
    listArguments = args;
    return {
      contacts: [contact],
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 }
    };
  });
  t.mock.method(service, "updateContact", async () => contact);
  t.mock.method(service, "deleteContact", async () => true);

  const [retrieved, listed, updated, deleted] = await Promise.all([
    request("/api/contacts/8"),
    request("/api/contacts?search=Ada&page=2&limit=5&sortBy=name&order=asc"),
    request("/api/contacts/8", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "+1 (415) 555-0100" })
    }),
    request("/api/contacts/8", { method: "DELETE" })
  ]);

  assert.equal(retrieved.status, 200);
  assert.deepEqual(retrieved.body.data, contact);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.contacts, [contact]);
  assert.deepEqual(listArguments, {
    search: "Ada",
    page: 2,
    limit: 5,
    sortBy: "name",
    order: "asc"
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.data, contact);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, "Contact deleted successfully");
});

test("search rejects repeated parameters and terms over the length limit", async (t) => {
  let serviceCalls = 0;
  t.mock.method(service, "listContacts", async () => {
    serviceCalls += 1;
    return { contacts: [], pagination: {} };
  });

  for (const path of [
    "/api/contacts?search=search-secret-one&search=search-secret-two",
    `/api/contacts?search=${"x".repeat(101)}`
  ]) {
    const response = await request(path);
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.doesNotMatch(JSON.stringify(response.body), /search-secret/);
  }

  assert.equal(serviceCalls, 0);
});

test("pagination rejects invalid values and unsafe offsets before service access", async (t) => {
  let serviceCalls = 0;
  t.mock.method(service, "listContacts", async () => {
    serviceCalls += 1;
    return { contacts: [], pagination: {} };
  });

  for (const path of [
    "/api/contacts?page=0",
    "/api/contacts?page=-1",
    "/api/contacts?page=1.5",
    "/api/contacts?page=not-a-number",
    "/api/contacts?page=9007199254740992",
    "/api/contacts?page=90071992547411&limit=100",
    "/api/contacts?page=1&page=2",
    "/api/contacts?limit=0",
    "/api/contacts?limit=101",
    "/api/contacts?limit=10&limit=20"
  ]) {
    const response = await request(path);
    assert.equal(response.status, 400, path);
    assert.equal(response.body.success, false);
  }

  assert.equal(serviceCalls, 0);
});

test("phone validation rejects punctuation-only values and accepts formatted numbers", async (t) => {
  const createdContact = {
    id: 1,
    name: "Ada",
    email: "ada@example.com",
    phone: "+1 (415) 555-0100"
  };
  let serviceCalls = 0;
  t.mock.method(service, "createContact", async (data) => {
    serviceCalls += 1;
    return { ...createdContact, phone: data.phone };
  });

  const invalid = await request("/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Ada",
      email: "ada@example.com",
      phone: "-------"
    })
  });
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(JSON.stringify(invalid.body), /-------/);

  const valid = await request("/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createdContact)
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.body.data.phone, createdContact.phone);
  assert.equal(serviceCalls, 1);

  const invalidPatch = await request("/api/contacts/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "-------" })
  });
  assert.equal(invalidPatch.status, 400);
  assert.equal(serviceCalls, 1);
});

test("unchanged PATCH returns the existing contact when MySQL reports no changed rows", async (t) => {
  const contact = {
    id: 8,
    name: "Ada",
    email: "ada@example.com",
    phone: "4155550100"
  };
  let exists = true;

  t.mock.method(pool, "execute", async (sql) => {
    if (sql.startsWith("UPDATE contacts")) {
      return [{ affectedRows: 0, changedRows: 0 }, []];
    }

    return [exists ? [contact] : [], []];
  });

  const unchanged = await request("/api/contacts/8", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada" })
  });
  assert.equal(unchanged.status, 200);
  assert.deepEqual(unchanged.body, { success: true, data: contact });

  exists = false;
  const missing = await request("/api/contacts/8", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada" })
  });
  assert.equal(missing.status, 404);
});

test("unexpected errors return generic messages and do not log error details", async (t) => {
  const sensitiveMessage = "private-contact-detail";
  const logged = [];
  t.mock.method(service, "getContactById", async () => {
    throw new Error(sensitiveMessage);
  });
  t.mock.method(console, "error", (...args) => logged.push(args));

  const response = await request("/api/contacts/123");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    message: "Internal server error"
  });
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(sensitiveMessage));
});

test("duplicate contacts retain the conflict response", async (t) => {
  t.mock.method(service, "createContact", async () => {
    const error = new Error("database detail");
    error.code = "ER_DUP_ENTRY";
    throw error;
  });

  const response = await request("/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Ada",
      email: "ada@example.com",
      phone: "4155550100"
    })
  });

  assert.equal(response.status, 409);
  assert.equal(
    response.body.message,
    "A contact with this email or phone already exists"
  );
});

test("malformed JSON receives a stable client-facing error", async () => {
  const response = await request("/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"name":'
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    message: "Invalid request"
  });
});
