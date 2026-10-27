
require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const connection = await pool.getConnection();

    await connection.ping();
    connection.release();

    console.log("MySQL connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed", {
      code: error?.code || "UNKNOWN"
    });
    process.exit(1);
  }
}

startServer();
