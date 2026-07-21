require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../config/cockroach");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function checksumOf(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Splits a .sql file into individual statements.
 * Strips comments first, then splits on ';'. This is naive in that it
 * doesn't understand string literals — a '--' or '/*' inside a quoted
 * string would be (incorrectly) treated as a real comment — but that's
 * fine for plain CREATE TABLE / ALTER TABLE files like ours, which have
 * no string literals containing comment-like sequences. If you ever add
 * functions/triggers with embedded semicolons or such literals, write
 * those migrations by hand instead of relying on this splitter.
 */
function stripComments(sql) {
  // Block comments: /* ... */ (including multi-line)
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // Line comments: -- to end of line
  result = result.replace(/--.*$/gm, "");
  return result;
}

function splitStatements(sql) {
  return stripComments(sql)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    );
  `);
  // Safe to run even if the column already exists from a previous version
  // of this script; CockroachDB skips it if present.
  await pool.query(`
    ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query("SELECT name, checksum FROM schema_migrations;");
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.name, row.checksum); // checksum may be null for older rows
  }
  return map;
}

async function runMigrationFile(filename, checksum) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullPath, "utf8");
  const statements = splitStatements(sql);

  console.log(`\nApplying ${filename} (${statements.length} statement(s))...`);

  // Run each statement as its OWN query -> its own implicit transaction.
  // This is what avoids CockroachDB's multi-statement DDL limitation.
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

  await pool.query(
    "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);",
    [filename, checksum]
  );
  console.log(`  Recorded ${filename} as applied.`);
}

async function migrate() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations(); // Map<filename, checksum|null>

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // relies on numeric prefixes, e.g. 0001_, 0002_

  // Check every already-applied file for content drift before doing anything else.
  const drifted = [];
  for (const file of files) {
    if (!applied.has(file)) continue;
    const recordedChecksum = applied.get(file);
    if (recordedChecksum === null) continue; // pre-checksum row, nothing to compare against
    const currentChecksum = checksumOf(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    if (currentChecksum !== recordedChecksum) {
      drifted.push(file);
    }
  }

  if (drifted.length > 0) {
    console.error("\nRefusing to continue: the following applied migration file(s) have changed since they were run:");
    for (const file of drifted) console.error(`  - ${file}`);
    console.error(
      "\nEditing an already-applied migration does not get re-run automatically, so your database " +
        "and your migration files have silently diverged. Revert these file(s) to match what was " +
        "actually applied, and put any new changes in a new migration file instead (e.g. the next " +
        "numbered .sql file)."
    );
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("No pending migrations. Database is up to date.");
    await pool.end();
    return;
  }

  console.log(`Found ${pending.length} pending migration(s): ${pending.join(", ")}`);

  try {
    for (const file of pending) {
      const checksum = checksumOf(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      await runMigrationFile(file, checksum);
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