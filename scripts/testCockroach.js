require("dotenv").config();

const pool = require("../config/cockroach");

async function testConnection() {
  try {
    console.log("Checking tables...");

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.table(result.rows);

    await pool.end();
  } catch (err) {
    console.error(err);
  }
}

testConnection();