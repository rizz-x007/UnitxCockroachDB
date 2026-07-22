require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const pool = require("../../config/cockroach");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PAGE_SIZE = 500;
const TABLES = [
  { name: "profiles", primaryKey: "id" },
  { name: "products", primaryKey: "id" },
  { name: "product_images", primaryKey: "id" },
  { name: "reviews", primaryKey: "id" },
  { name: "chat_rooms", primaryKey: "id" },
  { name: "chats", primaryKey: "id" },
  { name: "messages", primaryKey: "id" },
  { name: "notifications", primaryKey: "id" },
  { name: "email_verifications", primaryKey: "id" },
];

function quoteIdent(id) {
  return `"${id.replace(/"/g, '""')}"`;
}

async function getColumns(tableName) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position;`,
    [tableName]
  );
  if (res.rows.length === 0) {
    throw new Error(`Table "${tableName}" not found in CockroachDB. Has it been migrated (db/migrate.js)?`);
  }
  return res.rows.map((r) => r.column_name);
}

async function getForeignKeyEdges() {
  // parent_table must be migrated before child_table
  const res = await pool.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public';
  `);
  return res.rows;
}

function topoSort(tableNames, edges) {
  const inDegree = new Map(tableNames.map((t) => [t, 0]));
  const children = new Map(tableNames.map((t) => [t, []]));

  for (const { child_table, parent_table } of edges) {
    // Ignore FKs to tables outside our migration set, and self-references
    // (e.g. a table referencing its own primary key) — neither affects order.
    if (!inDegree.has(child_table) || !inDegree.has(parent_table)) continue;
    if (child_table === parent_table) continue;
    children.get(parent_table).push(child_table);
    inDegree.set(child_table, inDegree.get(child_table) + 1);
  }

  const byOriginalOrder = (a, b) => tableNames.indexOf(a) - tableNames.indexOf(b);
  let ready = tableNames.filter((t) => inDegree.get(t) === 0).sort(byOriginalOrder);
  const order = [];

  while (ready.length > 0) {
    const node = ready.shift();
    order.push(node);
    for (const child of children.get(node)) {
      inDegree.set(child, inDegree.get(child) - 1);
      if (inDegree.get(child) === 0) ready.push(child);
    }
    ready.sort(byOriginalOrder);
  }

  if (order.length !== tableNames.length) {
    const stuck = tableNames.filter((t) => !order.includes(t));
    throw new Error(
      `Circular foreign key dependency detected among: ${stuck.join(", ")}. ` +
        `Resolve manually (e.g. defer the FK or migrate that column separately).`
    );
  }

  return order;
}

async function getMigrationOrder(tableConfigs) {
  const names = tableConfigs.map((t) => t.name);
  const edges = await getForeignKeyEdges();
  const orderedNames = topoSort(names, edges);
  return orderedNames.map((n) => tableConfigs.find((t) => t.name === n));
}

async function fetchPage(tableName, primaryKey, from, to) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order(primaryKey, { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(`Supabase read failed on "${tableName}": ${error.message}`);
  }
  return data;
}

async function copyTable({ name, primaryKey }) {
  console.log(`\n--- ${name} ---`);

  const columns = await getColumns(name);
  const insertSql = `
    INSERT INTO ${quoteIdent(name)} (${columns.map(quoteIdent).join(", ")})
    VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
    ON CONFLICT (${quoteIdent(primaryKey)}) DO NOTHING;
  `;

  let from = 0;
  let fetched = 0;
  let inserted = 0;
  let skipped = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const page = await fetchPage(name, primaryKey, from, to);
    if (page.length === 0) break;

    fetched += page.length;

    for (const row of page) {
      // Pass every column through exactly as Supabase returned it.
      // No renaming, no deriving one column from another, no type
      // guessing — Postgres casts each $n to the real target column
      // type (from information_schema), so e.g. products.seller_id
      // (text) and products.user_id (uuid) are always inserted as
      // their own independent values, and NULL stays NULL.
      const params = columns.map((col) => (col in row ? row[col] : null));

      let result;
      try {
        result = await pool.query(insertSql, params);
      } catch (err) {
        console.error(`\nInsert failed in "${name}" for ${primaryKey}=${row[primaryKey]}: ${err.message}`);
        console.error(`Failing row:\n${JSON.stringify(row, null, 2)}`);
        console.error(`Stopping. Progress on "${name}": fetched=${fetched} inserted=${inserted} skipped=${skipped}`);
        throw err; // bubble up to stop the whole run, not just this table
      }

      if (result.rowCount === 1) inserted++;
      else skipped++;
    }

    console.log(`  Progress: fetched=${fetched} inserted=${inserted} skipped=${skipped}`);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`  Done: fetched=${fetched} inserted=${inserted} skipped=${skipped}`);
  return { fetched, inserted, skipped };
}

async function migrateAll() {
  const orderedTables = await getMigrationOrder(TABLES);
  console.log(`Migration order (from actual foreign keys): ${orderedTables.map((t) => t.name).join(" -> ")}`);

  // Optional: `node migrate-data.js products` runs just that table,
  // for spot-checking. No args = run everything, in the order above.
  const requested = process.argv.slice(2);
  const tablesToRun = requested.length
    ? orderedTables.filter((t) => requested.includes(t.name))
    : orderedTables;

  if (requested.length && tablesToRun.length === 0) {
    throw new Error(`No matching table(s) in TABLES for: ${requested.join(", ")}`);
  }

  console.log(`Starting data migration: Supabase -> CockroachDB (${tablesToRun.map((t) => t.name).join(", ")})`);

  const summary = [];

  for (const table of tablesToRun) {
    const result = await copyTable(table);
    summary.push({ table: table.name, ...result });
  }

  console.log("\n=== Migration summary ===");
  for (const row of summary) {
    console.log(`${row.table.padEnd(20)} fetched=${row.fetched} inserted=${row.inserted} skipped=${row.skipped}`);
  }

  await pool.end();
}

migrateAll().catch(async (err) => {
  console.error("\nMigration stopped due to error:", err.message);
  await pool.end();
  process.exit(1);
});