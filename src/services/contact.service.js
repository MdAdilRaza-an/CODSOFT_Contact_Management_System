
const pool = require("../config/db");

async function createContact(data) {
  const [result] = await pool.execute(
    `INSERT INTO contacts
     (name, email, phone, address, company)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.name,
      data.email,
      data.phone,
      data.address ?? null,
      data.company ?? null
    ]
  );

  return getContactById(result.insertId);
}

async function getContactById(id) {
  const [rows] = await pool.execute(
    "SELECT * FROM contacts WHERE id = ?",
    [id]
  );

  return rows[0] || null;
}

async function listContacts({ search, page, limit, sortBy, order }) {
  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    const error = new Error("Page offset is too large");
    error.status = 400;
    throw error;
  }

  const allowedSortFields = {
    name: "name",
    email: "email",
    phone: "phone",
    company: "company",
    created_at: "created_at"
  };

  const column = allowedSortFields[sortBy] || "created_at";
  const direction = order === "asc" ? "ASC" : "DESC";

  let where = "";
  const params = [];

  if (search) {
    where = "WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?";
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM contacts ${where}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT * FROM contacts ${where}
     ORDER BY ${column} ${direction}, id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    contacts: rows,
    pagination: {
      page,
      limit,
      total: countRows[0].total,
      totalPages: Math.ceil(countRows[0].total / limit)
    }
  };
}

async function updateContact(id, data) {
  const allowedFields = ["name", "email", "phone", "address", "company"];
  const fields = allowedFields.filter(
    (field) => Object.hasOwn(data, field)
  );

  if (!fields.length) {
    const error = new Error("No valid fields provided");
    error.status = 400;
    throw error;
  }

  const values = fields.map((field) => data[field] ?? null);
  const assignments = fields.map((field) => `${field} = ?`).join(", ");

  await pool.execute(
    `UPDATE contacts SET ${assignments} WHERE id = ?`,
    [...values, id]
  );

  return getContactById(id);
}

async function deleteContact(id) {
  const [result] = await pool.execute(
    "DELETE FROM contacts WHERE id = ?",
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  createContact,
  getContactById,
  listContacts,
  updateContact,
  deleteContact
};
