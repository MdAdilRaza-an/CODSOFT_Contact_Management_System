
const service = require("../services/contact.service");

// Handle API errors consistently
function handleError(res, error) {
  if (error?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "A contact with this email or phone already exists"
    });
  }

  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      message: error.message
    });
  }

  console.error("Contact API request failed", {
    code: error?.code || "UNKNOWN"
  });

  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
}

// Create a new contact
async function create(req, res) {
  try {
    const contact = await service.createContact(req.body);

    return res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Retrieve contacts with search, sorting and pagination
async function list(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    const result = await service.listContacts({
      search: req.query.search?.trim(),
      page,
      limit,
      sortBy: req.query.sortBy || "created_at",
      order: req.query.order || "desc"
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Retrieve one contact by ID
async function getById(req, res) {
  try {
    const contact = await service.getContactById(
      Number(req.params.id)
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Update an existing contact
async function update(req, res) {
  try {
    const contact = await service.updateContact(
      Number(req.params.id),
      req.body
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Delete a contact by ID
async function remove(req, res) {
  try {
    const deleted = await service.deleteContact(
      Number(req.params.id)
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove
};
