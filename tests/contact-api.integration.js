const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { test } = require("node:test");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true
});

const personalDatabase = "contact_management_db";
const testDatabase = "contact_management_test_db";

if (process.env.DB_NAME !== personalDatabase) {
  throw new Error(
    "Integration tests require the configured DB_NAME to be contact_management_db."
  );
}

if (personalDatabase === testDatabase) {
  throw new Error("Integration test database must differ from the personal database.");
}

process.env.DB_NAME = testDatabase;

const app = require("../src/app");
const pool = require("../src/config/db");

async function request(baseUrl, route, options) {
  const response = await fetch(new URL(route, baseUrl), options);

  return {
    status: response.status,
    body: await response.json()
  };
}

test("live MySQL contact API integration uses only the disposable test database", async () => {
  const tag = `cms-${randomUUID()}`;
  const contacts = [
    {
      name: `Integration ${tag} Alpha`,
      email: `${tag}-alpha@example.test`,
      phone: "4155550101",
      company: "Integration"
    },
    {
      name: `Integration ${tag} Bravo`,
      email: `${tag}-bravo@example.test`,
      phone: "4155550102",
      company: "Integration"
    },
    {
      name: `Integration ${tag} Charlie`,
      email: `${tag}-charlie@example.test`,
      phone: "4155550103",
      company: "Integration"
    }
  ];
  const emails = contacts.map(({ email }) => email);
  const invalidEmail = `${tag}-invalid@example.test`;
  const attemptedEmails = new Set();
  let server;
  let baseUrl;
  let testFailure;
  let cleanupFailure;

  try {
    const connection = await pool.getConnection();
    try {
      const [databaseRows] = await connection.query(
        "SELECT DATABASE() AS database_name"
      );
      assert.equal(databaseRows[0].database_name, testDatabase);

      const [tableRows] = await connection.query(
        "SELECT COUNT(*) AS table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        ["contacts"]
      );
      assert.equal(Number(tableRows[0].table_count), 1);

      const [countRows] = await connection.query(
        "SELECT COUNT(*) AS total FROM contacts"
      );
      assert.equal(
        Number(countRows[0].total),
        0,
        "Disposable test table must be empty before integration tests."
      );

      const [collisionRows] = await connection.execute(
        "SELECT id FROM contacts WHERE email IN (?, ?, ?)",
        emails
      );
      assert.equal(collisionRows.length, 0);
    } finally {
      connection.release();
    }

    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const health = await request(baseUrl, "/api/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, {
      success: true,
      message: "Contact Management API is running"
    });

    const created = [];
    for (const contact of contacts) {
      attemptedEmails.add(contact.email);
      const response = await request(baseUrl, "/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contact)
      });
      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.email, contact.email);
      assert.ok(Number.isSafeInteger(response.body.data.id));
      created.push(response.body.data);
    }

    const retrieved = await request(
      baseUrl,
      `/api/contacts/${created[0].id}`
    );
    assert.equal(retrieved.status, 200);
    assert.equal(retrieved.body.data.email, contacts[0].email);

    const searched = await request(
      baseUrl,
      `/api/contacts?search=${encodeURIComponent(tag)}&sortBy=name&order=asc&limit=2&page=1`
    );
    assert.equal(searched.status, 200);
    assert.equal(searched.body.pagination.total, 3);
    assert.equal(searched.body.contacts.length, 2);
    assert.match(searched.body.contacts[0].name, /Alpha/);
    assert.match(searched.body.contacts[1].name, /Bravo/);

    const secondPage = await request(
      baseUrl,
      `/api/contacts?search=${encodeURIComponent(tag)}&sortBy=name&order=asc&limit=2&page=2`
    );
    assert.equal(secondPage.status, 200);
    assert.equal(secondPage.body.contacts.length, 1);
    assert.match(secondPage.body.contacts[0].name, /Charlie/);

    const updated = await request(
      baseUrl,
      `/api/contacts/${created[0].id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: "Updated Integration" })
      }
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.company, "Updated Integration");

    const unchanged = await request(
      baseUrl,
      `/api/contacts/${created[0].id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: "Updated Integration" })
      }
    );
    assert.equal(unchanged.status, 200);
    assert.equal(unchanged.body.data.company, "Updated Integration");

    const duplicate = await request(baseUrl, "/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...contacts[0],
        phone: "4155550199"
      })
    });
    assert.equal(duplicate.status, 409);

    for (const id of ["0", "-1", "1.5", "not-a-number", "9007199254740992"]) {
      const responses = await Promise.all([
        request(baseUrl, `/api/contacts/${id}`),
        request(baseUrl, `/api/contacts/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Invalid ID" })
        }),
        request(baseUrl, `/api/contacts/${id}`, { method: "DELETE" })
      ]);
      assert.deepEqual(
        responses.map(({ status }) => status),
        [400, 400, 400],
        `Invalid ID: ${id}`
      );
    }

    attemptedEmails.add(invalidEmail);
    const invalidPhone = await request(baseUrl, "/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Invalid ${tag}`,
        email: invalidEmail,
        phone: "-------"
      })
    });
    assert.equal(invalidPhone.status, 400);

    const invalidPage = await request(
      baseUrl,
      "/api/contacts?page=90071992547411&limit=100"
    );
    assert.equal(invalidPage.status, 400);

    const deleted = await request(
      baseUrl,
      `/api/contacts/${created[2].id}`,
      { method: "DELETE" }
    );
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.message, "Contact deleted successfully");

    const missingAfterDelete = await request(
      baseUrl,
      `/api/contacts/${created[2].id}`
    );
    assert.equal(missingAfterDelete.status, 404);
  } catch (error) {
    testFailure = error;
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }).catch((error) => {
        cleanupFailure = error;
      });
    }

    try {
      const connection = await pool.getConnection();
      try {
        const [databaseRows] = await connection.query(
          "SELECT DATABASE() AS database_name"
        );
        if (databaseRows[0].database_name !== testDatabase) {
          throw new Error("Refusing cleanup outside the disposable test database.");
        }

        const attempted = [...attemptedEmails];
        if (attempted.length) {
          const placeholders = attempted.map(() => "?").join(", ");
          const [ownedRows] = await connection.execute(
            `SELECT id, email FROM contacts WHERE email IN (${placeholders})`,
            attempted
          );
          const ownedIds = ownedRows.map((row) => Number(row.id));
          if (ownedRows.some((row) => !attemptedEmails.has(row.email))) {
            throw new Error("Refusing cleanup of a contact not attempted by this test run.");
          }

          if (ownedIds.length) {
            const idPlaceholders = ownedIds.map(() => "?").join(", ");
            await connection.execute(
              `DELETE FROM contacts WHERE id IN (${idPlaceholders})`,
              ownedIds
            );
          }

          const [remainingRows] = await connection.execute(
            `SELECT COUNT(*) AS total FROM contacts WHERE email IN (${placeholders})`,
            attempted
          );
          if (Number(remainingRows[0].total) !== 0) {
            throw new Error("One or more integration test contacts remain.");
          }
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      cleanupFailure = error;
    }

    await pool.end().catch((error) => {
      cleanupFailure = cleanupFailure || error;
    });
  }

  if (cleanupFailure) {
    throw new Error(
      `Integration cleanup failed (${cleanupFailure.code || "UNKNOWN"}); test database may contain test data.`
    );
  }

  if (testFailure) {
    throw testFailure;
  }

  assert.ok(true, "Live CRUD checks passed; current-run test contacts were removed.");
});
