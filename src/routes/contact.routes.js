
const express = require("express");
const router = express.Router();

const controller = require("../controllers/contact.controller");
const validateRequest = require("../middlewares/validateContact");

const {
  createContactRules,
  contactIdRules,
  updateContactRules,
  listContactRules
} = require("../validators/contact.validator");

router.post(
  "/",
  createContactRules,
  validateRequest,
  controller.create
);

router.get(
  "/",
  listContactRules,
  validateRequest,
  controller.list
);

router.get(
  "/:id",
  contactIdRules,
  validateRequest,
  controller.getById
);

router.patch(
  "/:id",
  updateContactRules,
  validateRequest,
  controller.update
);

router.delete(
  "/:id",
  contactIdRules,
  validateRequest,
  controller.remove
);

module.exports = router;
