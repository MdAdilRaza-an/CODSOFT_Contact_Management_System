
const express = require("express");
const contactsRouter = require("./routes/contact.routes");

const app = express();

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Contact Management API is running"
  });
});

app.use("/api/contacts", contactsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

app.use((err, req, res, next) => {
  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 500
      ? err.status
      : 500;
  const messages = {
    400: "Invalid request",
    413: "Request body too large",
    415: "Unsupported media type"
  };

  if (status === 500) {
    console.error("Unhandled API error", { code: err.code || "UNKNOWN" });
  }

  res.status(status).json({
    success: false,
    message: messages[status] || (status === 500 ? "Internal server error" : "Request failed")
  });
});

module.exports = app;
