
const { body, param, query } = require("express-validator");

const phoneNumberPattern = /^(?=.*\d)[+0-9().\-\s]{7,20}$/;

const contactIdRules = [
  param("id")
    .custom(
      (value) =>
        typeof value === "string" &&
        value.length > 0 &&
        !/\D/.test(value) &&
        Number(value) > 0 &&
        Number.isSafeInteger(Number(value))
    )
    .withMessage("Invalid contact ID")
];

const pageRules = [
  query("page")
    .optional()
    .isString()
    .withMessage("Page must be a positive integer")
    .bail()
    .matches(/^\d+$/)
    .withMessage("Page must be a positive integer")
    .bail()
    .custom((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0)
    .withMessage("Page must be a positive integer")
    .bail()
    .custom((value, { req }) => {
      const requestedLimit =
        req.query.limit === undefined ? 10 : Number(req.query.limit);
      const offset = (Number(value) - 1) * requestedLimit;

      return Number.isSafeInteger(requestedLimit) &&
        requestedLimit >= 1 &&
        requestedLimit <= 100 &&
        Number.isSafeInteger(offset);
    })
    .withMessage("Page offset is too large")
];

const createContactRules = [
  body("name")
    .isString()
    .withMessage("Name must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name must be at most 100 characters"),

  body("email")
    .isString()
    .withMessage("Email must be text")
    .bail()
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("phone")
    .isString()
    .withMessage("Phone must be text")
    .bail()
    .trim()
    .matches(phoneNumberPattern)
    .withMessage("A valid phone number is required"),

  body("address")
    .optional({ values: "null" })
    .isString()
    .withMessage("Address must be text")
    .bail()
    .isLength({ max: 255 })
    .withMessage("Address must be at most 255 characters"),

  body("company")
    .optional({ values: "null" })
    .isString()
    .withMessage("Company must be text")
    .bail()
    .isLength({ max: 150 })
    .withMessage("Company must be at most 150 characters")
];

const updateContactRules = [
  ...contactIdRules,

  body()
    .custom((value) => {
      const allowed = ["name", "email", "phone", "address", "company"];
      const keys = Object.keys(value || {});

      if (
        !keys.length ||
        keys.some((key) => !allowed.includes(key))
      ) {
        throw new Error("Provide valid contact fields to update");
      }

      return true;
    }),

  body("name")
    .optional()
    .isString()
    .withMessage("Name must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max: 100 }),

  body("email")
    .optional()
    .isString()
    .withMessage("Email must be text")
    .bail()
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),

  body("phone")
    .optional()
    .isString()
    .withMessage("Phone must be text")
    .bail()
    .trim()
    .matches(phoneNumberPattern)
    .withMessage("A valid phone number is required"),

  body("address")
    .optional({ values: "null" })
    .isString()
    .withMessage("Address must be text")
    .bail()
    .isLength({ max: 255 }),

  body("company")
    .optional({ values: "null" })
    .isString()
    .withMessage("Company must be text")
    .bail()
    .isLength({ max: 150 })
];

const listContactRules = [
  ...pageRules,

  query("limit")
    .optional()
    .isString()
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .matches(/^\d+$/)
    .withMessage("Limit must be between 1 and 100")
    .bail()
    .custom((value) => {
      const limit = Number(value);

      return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100;
    })
    .withMessage("Limit must be between 1 and 100"),

  query("sortBy")
    .optional()
    .isIn(["name", "email", "phone", "company", "created_at"])
    .withMessage("Invalid sort field"),

  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be asc or desc"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be text")
    .bail()
    .isLength({ max: 100 })
    .withMessage("Search must be at most 100 characters")
    .bail()
    .trim()
];

module.exports = {
  createContactRules,
  contactIdRules,
  updateContactRules,
  listContactRules
};
