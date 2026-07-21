require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../config/cockroach");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
async function getAppliedMigrations() {
  const result = await pool.query("SELECT name FROM schema_migrations;");
  return new Set(result.rows.map((r) => r.name));
}
async function runMigrationFile(filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullPath, "utf8");
  const statements = splitStatements(sql);

  console.log(`\nApplying ${filename} (${statements.length} statement(s))...`);
  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, " ").slice(0, 70);
    try {
      await pool.query(statement);
      console.log(`  ✓ ${preview}...`);
    } catch (err) {
      console.error(`  ✗ Failed on statement: ${preview}...`);
      throw err; // stop this file; don't mark it as applied
    }
  }

  await pool.query("INSERT INTO schema_migrations (name) VALUES ($1);", [
    filename,
  ]);
  console.log(`  Recorded ${filename} as applied.`);
}

async function migrate() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // relies on numeric prefixes, e.g. 0001_, 0002_
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("No pending migrations. Database is up to date.");
    await pool.end();
    return;
  }
  console.log(`Found ${pending.length} pending migration(s): ${pending.join(", ")}`);
  try {
    for (const file of pending) {
      await runMigrationFile(file);
    }
    console.log("\nAll migrations applied successfully.");
  } catch (err) {
    console.error("\nMigration failed, stopping:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();