require("dotenv").config();

const pool = require("../config/cockroach");

async function testConnection() {
  try {
    console.log("Connecting...");

    const result = await pool.query("SELECT NOW()");

    console.log("Connected!");
    console.log(result.rows);

    await pool.end();
  } catch (err) {
    console.error(err);
  }
}

testConnection();