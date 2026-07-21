require("dotenv").config();

const fs = require("fs");
const pool = require("../config/cockroach");

async function testConnection() {
  try {
    console.log("Executing schema...");

    const sql = fs.readFileSync("db/schema.sql", "utf8");

    await pool.query(sql);

    console.log("Schema executed successfully!");

    await pool.end();
  } catch (err) {
    console.error(err);
  }
}

testConnection();