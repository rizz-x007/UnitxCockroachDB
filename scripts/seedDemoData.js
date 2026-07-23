/**
 * scripts/seedDemoData.js
 *
 * Seeds the marketplace with demo sellers and listings:
 *   - Creates a real Supabase Auth user per seller (so they can actually log in)
 *   - Inserts the matching profile row into CockroachDB
 *   - Inserts 3-4 products per seller into CockroachDB
 *
 * Column safety: db/schema.sql and db/migrations/*.sql disagree with each
 * other on several columns (e.g. products.campus/status exist in the
 * migration but not in schema.sql). Rather than guess which is actually
 * live, this script introspects information_schema.columns at runtime —
 * same technique db/data-migration/migrate-data.js already uses — and only
 * inserts values into columns that actually exist on your database. Any
 * generated field that doesn't have a matching column is silently skipped.
 *
 * Usage:
 *   node scripts/seedDemoData.js              # actually seeds
 *   node scripts/seedDemoData.js --dry-run     # preview only, no writes
 *   node scripts/seedDemoData.js --sellers=10  # seed a smaller batch
 *
 * Required env vars (.env):
 *   DATABASE_URL           - CockroachDB connection string
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_KEY   - Supabase service role key (admin access)
 *
 * Optional:
 *   SEED_SELLER_PASSWORD   - shared login password for all seeded sellers
 *                            (default: 'UniThriftSeed!23')
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Reuses the project's existing CockroachDB pool config — this file has no
// hard env-var validation of its own (unlike config/env.js), so it's safe
// to require standalone for a seeding script.
const pool = require('../config/cockroach');

const DEFAULT_SELLER_COUNT = 40;
const MIN_PRODUCTS_PER_SELLER = 3;
const MAX_PRODUCTS_PER_SELLER = 4;
const SEED_PASSWORD = process.env.SEED_SELLER_PASSWORD || 'UniThriftSeed!23';
const SEED_EMAIL_DOMAIN = 'example.edu'; // RFC 2606 reserved domain — never a real inbox
const CREATE_USER_DELAY_MS = 150; // spread out Supabase Admin API calls

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const sellerCountArg = args.find((a) => a.startsWith('--sellers='));
const sellerCount = sellerCountArg
  ? parseInt(sellerCountArg.split('=')[1], 10)
  : DEFAULT_SELLER_COUNT;

// ---------------------------------------------------------------------------
// Demo data pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Diya', 'Arjun', 'Isha',
  'Karan', 'Neha', 'Aditya', 'Meera', 'Rahul', 'Sanya', 'Dev', 'Tara',
  'Nikhil', 'Pooja', 'Siddharth', 'Kavya', 'Aryan', 'Riya', 'Varun', 'Anika',
  'Ishaan', 'Simran', 'Yash', 'Nandini', 'Kabir', 'Aditi',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Gupta', 'Iyer', 'Nair', 'Singh', 'Kumar',
  'Rao', 'Mehta', 'Joshi', 'Verma', 'Chatterjee', 'Bose', 'Kapoor',
  'Malhotra', 'Desai', 'Pillai', 'Bhatt', 'Chauhan',
];

const COLLEGES = [
  { name: 'Delhi University', campuses: ['North Campus', 'South Campus'] },
  { name: 'IIT Bombay', campuses: ['Main Campus', 'Hostel Zone'] },
  { name: 'Anna University', campuses: ['Guindy Campus'] },
  { name: 'Manipal Institute of Technology', campuses: ['Manipal Campus'] },
  { name: 'BITS Pilani', campuses: ['Pilani Campus', 'Hyderabad Campus'] },
  { name: 'Christ University', campuses: ['Central Campus', 'Bannerghatta Campus'] },
  { name: 'VIT Vellore', campuses: ['Main Campus'] },
  { name: 'Symbiosis International University', campuses: ['Lavale Campus', 'Viman Nagar Campus'] },
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Used'];

const PAYMENT_METHOD_OPTIONS = [
  'UPI',
  'Cash',
  'UPI, Cash',
  'Cash, Bank Transfer',
  'UPI, Cash, Bank Transfer',
];

const CATEGORIES = {
  Textbooks: [
    'Organic Chemistry Textbook',
    'Calculus: Early Transcendentals (3rd Edition)',
    'Introduction to Psychology Textbook',
    'Data Structures & Algorithms Textbook',
    'Principles of Microeconomics Textbook',
  ],
  Electronics: [
    'TI-84 Plus Graphing Calculator',
    'Wireless Earbuds',
    'USB-C Desk Lamp',
    'Portable Bluetooth Speaker',
    'Adjustable Laptop Stand',
  ],
  Furniture: [
    'Compact Study Desk',
    'Bean Bag Chair',
    '3-Shelf Bookcase',
    'Ergonomic Office Chair',
    'Bedside Table',
  ],
  Clothing: [
    'University Hoodie (Size M)',
    'Winter Puffer Jacket',
    'Formal Blazer',
    'Running Shoes (Size 9)',
    'Denim Jacket',
  ],
  'Sports Equipment': [
    'Badminton Racket Set (2 rackets)',
    'Yoga Mat',
    'Regulation Football',
    'Adjustable Dumbbell Set',
    'Skateboard',
  ],
  'Dorm Essentials': [
    'Compact Mini Fridge',
    'Table Fan',
    'Set of 3 Storage Bins',
    'Blackout Curtains',
    'Bed Sheet Set (Single)',
  ],
  'Musical Instruments': [
    'Acoustic Guitar',
    '61-Key Keyboard Piano',
    'Soprano Ukulele',
    'Harmonica Set',
  ],
  Stationery: [
    'Engineering Drafting Kit',
    'Scientific Calculator',
    'Notebook Bundle (5-pack)',
    'Art Supply Kit',
  ],
  Bicycles: [
    'Mountain Bike (21-speed)',
    'Hybrid City Bicycle',
    'Bike Lock and Helmet Combo',
  ],
  'Kitchen Appliances': [
    'Electric Kettle',
    'Mini Microwave',
    '2-Slice Toaster',
    'Rice Cooker',
  ],
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10); // DATE column, no time component
}

function priceForCategory(category) {
  const ranges = {
    Textbooks: [200, 1200],
    Electronics: [500, 6000],
    Furniture: [400, 4000],
    Clothing: [150, 1500],
    'Sports Equipment': [200, 3000],
    'Dorm Essentials': [300, 5000],
    'Musical Instruments': [800, 8000],
    Stationery: [50, 800],
    Bicycles: [1500, 9000],
    'Kitchen Appliances': [400, 3000],
  };
  const [min, max] = ranges[category] || [100, 2000];
  return randomInt(min, max);
}

/**
 * Builds a synthetic 10-digit phone number. Clearly fake (starts 9000),
 * never a real dialable number.
 * @returns {string}
 */
function fakePhone() {
  return `9000${randomInt(100000, 999999)}`;
}

// ---------------------------------------------------------------------------
// Schema introspection (mirrors db/data-migration/migrate-data.js getColumns)
// ---------------------------------------------------------------------------

const columnCache = new Map();

/**
 * Returns the actual column names for a table, as they exist on the live
 * database right now.
 *
 * @param {string} tableName
 * @returns {Promise<string[]>}
 */
async function getColumns(tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position;`,
    [tableName]
  );
  if (res.rows.length === 0) {
    throw new Error(`Table "${tableName}" not found. Has it been migrated (db/migrate.js)?`);
  }
  const columns = res.rows.map((r) => r.column_name);
  columnCache.set(tableName, columns);
  return columns;
}

function quoteIdent(id) {
  return `"${id.replace(/"/g, '""')}"`;
}

/**
 * Inserts a row into a table, silently dropping any key in `data` that
 * doesn't correspond to a real column on the live table.
 *
 * @param {string} tableName
 * @param {Object} data - Candidate field values, keyed by column name.
 * @param {Object} [options]
 * @param {string} [options.conflictColumn] - If set, adds
 *   ON CONFLICT (col) DO NOTHING.
 * @returns {Promise<void>}
 */
async function insertRow(tableName, data, { conflictColumn } = {}) {
  const columns = await getColumns(tableName);
  const usableKeys = Object.keys(data).filter(
    (key) => columns.includes(key) && data[key] !== undefined
  );

  if (usableKeys.length === 0) {
    throw new Error(`No matching columns found on "${tableName}" for the provided data`);
  }

  const columnList = usableKeys.map(quoteIdent).join(', ');
  const placeholders = usableKeys.map((_, i) => `$${i + 1}`).join(', ');
  const values = usableKeys.map((key) => data[key]);

  const conflictClause = conflictColumn
    ? `ON CONFLICT (${quoteIdent(conflictColumn)}) DO NOTHING`
    : '';

  const sql = `INSERT INTO ${quoteIdent(tableName)} (${columnList}) VALUES (${placeholders}) ${conflictClause}`;
  await pool.query(sql, values);
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SeedSeller
 * @property {string} username
 * @property {string} email
 * @property {string} fullName
 * @property {string} collegeName
 * @property {string} campus
 * @property {string} phone
 * @property {boolean} sellerVerified
 */

/**
 * @param {number} index
 * @returns {SeedSeller}
 */
function generateSeller(index) {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const college = pick(COLLEGES);
  const campus = pick(college.campuses);

  // Index suffix guarantees uniqueness across all 40 usernames/emails even
  // when the same first+last name combination is picked twice.
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}`;
  const email = `${username}@${SEED_EMAIL_DOMAIN}`;

  return {
    username,
    email,
    fullName: `${firstName} ${lastName}`,
    collegeName: college.name,
    campus,
    phone: fakePhone(),
    sellerVerified: Math.random() < 0.7, // most sellers verified, some not
  };
}

/**
 * @param {SeedSeller} seller
 * @returns {Object}
 */
function generateProduct(seller) {
  const category = pick(Object.keys(CATEGORIES));
  const title = pick(CATEGORIES[category]);
  const condition = pick(CONDITIONS);

  return {
    title,
    category,
    price: priceForCategory(category),
    condition,
    description: `${condition} condition ${title.toLowerCase()}. Pickup available on ${seller.campus}, ${seller.collegeName}. Message for more details or to negotiate.`,
    college_name: seller.collegeName,
    campus: seller.campus,
    contact_no: seller.phone,
    delivery_date: futureDate(randomInt(2, 10)),
    payment_methods: pick(PAYMENT_METHOD_OPTIONS),
    is_sold: false,
    sold: false,
    status: 'available',
    ai_verified: false,
    views: 0,
  };
}

// ---------------------------------------------------------------------------
// Supabase Auth (admin) client
// ---------------------------------------------------------------------------

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in environment.');
  console.error('These are required to create real Supabase Auth users for seeded sellers.');
  process.exit(1);
}

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Creates a Supabase Auth user, pre-confirmed (no OTP round-trip needed).
 *
 * @param {SeedSeller} seller
 * @returns {Promise<string>} The new auth user's UUID.
 */
async function createAuthUser(seller) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: seller.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { username: seller.username },
  });

  if (error) {
    throw new Error(`Supabase createUser failed for ${seller.email}: ${error.message}`);
  }

  return data.user.id;
}

/**
 * Compensating cleanup, mirroring the rollback pattern already used in
 * routes/authRoutes.js: if the CockroachDB profile insert fails after the
 * Auth user was created, delete the orphaned Auth user rather than leaving
 * a seller who can log in but has no profile/listings.
 *
 * @param {string} authUserId
 */
async function deleteAuthUser(authUserId) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  if (error) {
    console.error(`  Failed to clean up orphaned Auth user ${authUserId}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedSeller(index) {
  const seller = generateSeller(index);
  const products = Array.from(
    { length: randomInt(MIN_PRODUCTS_PER_SELLER, MAX_PRODUCTS_PER_SELLER) },
    () => generateProduct(seller)
  );

  if (isDryRun) {
    return { seller, products, created: false };
  }

  const authUserId = await createAuthUser(seller);
  await sleep(CREATE_USER_DELAY_MS);

  try {
    await insertRow(
      'profiles',
      {
        id: authUserId,
        username: seller.username,
        email: seller.email,
        full_name: seller.fullName,
        college_name: seller.collegeName,
        location_name: seller.campus,
        phone: seller.phone,
        student_verified: true,
        seller_verified: seller.sellerVerified,
        is_admin: false,
      },
      { conflictColumn: 'id' }
    );
  } catch (err) {
    console.error(`  Profile insert failed for ${seller.email}, rolling back Auth user: ${err.message}`);
    await deleteAuthUser(authUserId);
    throw err;
  }

  let productsCreated = 0;
  for (const product of products) {
    try {
      await insertRow('products', {
        ...product,
        user_id: authUserId,
        seller_id: authUserId,
      });
      productsCreated += 1;
    } catch (err) {
      console.error(`  Product insert failed for ${seller.email} ("${product.title}"): ${err.message}`);
    }
  }

  return { seller, products: products.slice(0, productsCreated), created: true, authUserId };
}

async function main() {
  console.log(
    isDryRun
      ? `Dry run: previewing ${sellerCount} sellers (no writes to Supabase or CockroachDB)...`
      : `Seeding ${sellerCount} sellers into Supabase Auth + CockroachDB...`
  );

  const results = [];
  let failures = 0;

  for (let i = 1; i <= sellerCount; i += 1) {
    try {
      const result = await seedSeller(i);
      results.push(result);
      console.log(
        `  [${i}/${sellerCount}] ${result.seller.email} — ${result.products.length} product(s)`
      );
    } catch (err) {
      failures += 1;
      console.error(`  [${i}/${sellerCount}] FAILED: ${err.message}`);
    }
  }

  const totalProducts = results.reduce((sum, r) => sum + r.products.length, 0);

  console.log('\n=== Seed summary ===');
  console.log(`Sellers requested: ${sellerCount}`);
  console.log(`Sellers seeded:    ${results.length}`);
  console.log(`Sellers failed:    ${failures}`);
  console.log(`Products seeded:   ${totalProducts}`);

  if (!isDryRun && results.length > 0) {
    console.log(`\nShared login password for all seeded sellers: ${SEED_PASSWORD}`);

    const outputDir = path.join(__dirname, 'seed-output');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `seeded-sellers-${Date.now()}.json`);
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          password: SEED_PASSWORD,
          sellers: results.map((r) => ({ email: r.seller.email, username: r.seller.username })),
        },
        null,
        2
      )
    );
    console.log(`Seller email/username list written to: ${outputPath}`);
    console.log('(This file contains only fake demo data, but do not commit it — add scripts/seed-output/ to .gitignore.)');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('\nSeeding stopped due to an unexpected error:', err.message);
  await pool.end();
  process.exit(1);
});