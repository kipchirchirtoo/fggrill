#!/usr/bin/env node

/*
 * Clean database rebuild helper.
 *
 * Defaults are dry-run and read-only. Mutating commands require --execute.
 * The script deliberately masks connection details and never prints secrets.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const cleanDbDir = path.join(backendDir, 'supabase', 'clean-db');
const schemaFile = path.join(cleanDbDir, 'migrations', '0001_clean_core_schema.sql');
const etlDir = path.join(cleanDbDir, 'etl');

dotenv.config({ path: path.join(backendDir, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const defaultColumnsCsv =
  '/home/john/Downloads/Supabase Snippet List Columns with Estimated Row Counts.csv';
const defaultSnapshotCsv =
  '/home/john/Downloads/Supabase Snippet Full Database Snapshot Dump.csv';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'audit';
const execute = args.includes('--execute');

function log(message = '') {
  process.stdout.write(`${message}\n`);
}

function fail(message, error) {
  log(`\nERROR: ${message}`);
  if (error && error.message) log(error.message);
  process.exitCode = 1;
}

function maskConnectionString(value) {
  if (!value) return '(missing)';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.username ? '<user>@' : ''}${url.host}${url.pathname ? '/<database>' : ''}`;
  } catch (_) {
    return '(set, non-url format)';
  }
}

function createPool(connectionString, label) {
  if (!connectionString) return null;
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 1000,
    max: 3,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
    application_name: `famousgate_clean_db_${label}`,
  });
}

async function withPool(pool, fn) {
  if (!pool) return null;
  try {
    return await fn(pool);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift() || [];
  return rows
    .filter((candidate) => candidate.some((value) => value !== ''))
    .map((candidate) => {
      const item = {};
      header.forEach((key, index) => {
        item[key] = candidate[index] || '';
      });
      return item;
    });
}

function readCsvIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function summarizeCsvSnapshots() {
  const columnsPath = process.env.SUPABASE_COLUMNS_CSV || defaultColumnsCsv;
  const snapshotPath = process.env.SUPABASE_SNAPSHOT_CSV || defaultSnapshotCsv;
  const columns = readCsvIfPresent(columnsPath);
  const snapshot = readCsvIfPresent(snapshotPath);

  log('CSV snapshot inputs:');
  log(`  columns csv:  ${fs.existsSync(columnsPath) ? columnsPath : '(missing)'}`);
  log(`  snapshot csv: ${fs.existsSync(snapshotPath) ? snapshotPath : '(missing)'}`);

  if (!columns && !snapshot) return;

  if (columns) {
    const publicRows = columns.filter((row) => schemaName(row) === 'public');
    const tables = new Set(publicRows.map((row) => row.table_name).filter(Boolean));
    const branchTypes = countBy(publicRows.filter((row) => row.column_name === 'branch_id'), 'data_type');
    const idTypes = countBy(publicRows.filter((row) => row.column_name === 'id'), 'data_type');

    log('\nColumns CSV summary:');
    log(`  public column rows: ${publicRows.length}`);
    log(`  public tables:      ${tables.size}`);
    log(`  branch_id types:    ${formatCounts(branchTypes)}`);
    log(`  id types:           ${formatCounts(idTypes)}`);
  }

  if (snapshot) {
    const publicRows = snapshot.filter((row) => schemaName(row) === 'public');
    let active = 0;
    for (const row of publicRows) {
      if (snapshotRowHasData(row)) active += 1;
    }

    log('\nFull snapshot CSV summary:');
    log(`  public tables: ${publicRows.length}`);
    log(`  active tables: ${active}`);
    log(`  empty tables:  ${Math.max(publicRows.length - active, 0)}`);
  }
}

function schemaName(row) {
  return row.table_schema || row.schema_name || row.schemaname || '';
}

function snapshotRowHasData(row) {
  const possibleKeys = ['all_data_rows', 'sample_rows', 'rows', 'data'];
  for (const key of possibleKeys) {
    const value = row[key];
    if (!value || value === '[]' || value === '{}') continue;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
    } catch (_) {
      return value.trim().length > 2;
    }
  }
  const estimate = Number(row.estimated_row_count || row.row_count || 0);
  return Number.isFinite(estimate) && estimate > 0;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || '(blank)';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function formatCounts(counts) {
  if (!counts || !counts.size) return '(none)';
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

async function queryLiveSummary(pool, label) {
  log(`\n${label} database summary:`);
  try {
    const summary = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
        (SELECT count(*)::int FROM information_schema.views WHERE table_schema = 'public') AS views,
        (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') AS enums,
        EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'legacy_import') AS has_legacy_import
    `);
    const branchTypes = await pool.query(`
      SELECT data_type, count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'branch_id'
      GROUP BY data_type
      ORDER BY count DESC, data_type
    `);
    const idTypes = await pool.query(`
      SELECT data_type, count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id'
      GROUP BY data_type
      ORDER BY count DESC, data_type
    `);

    const row = summary.rows[0];
    log(`  public base tables: ${row.tables}`);
    log(`  public views:       ${row.views}`);
    log(`  public enums:       ${row.enums}`);
    log(`  legacy_import:      ${row.has_legacy_import ? 'present' : 'missing'}`);
    log(`  branch_id types:    ${branchTypes.rows.map((item) => `${item.data_type}:${item.count}`).join(', ') || '(none)'}`);
    log(`  id types:           ${idTypes.rows.map((item) => `${item.data_type}:${item.count}`).join(', ') || '(none)'}`);
  } catch (error) {
    log(`  unable to inspect ${label}: ${error.message}`);
  }
}

function collectBackendTableRefs() {
  const refs = new Set();
  const patterns = [
    /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /from\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ];
  walk(path.join(backendDir, 'src'), (filePath) => {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text))) {
        const name = match[1];
        if (name && !name.includes('${')) refs.add(name);
      }
    }
  });
  return [...refs].sort();
}

function walk(start, visitor) {
  if (!fs.existsSync(start)) return;
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const fullPath = path.join(start, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', '.venv', '.dart_tool'].includes(entry.name)) continue;
      walk(fullPath, visitor);
    } else {
      visitor(fullPath);
    }
  }
}

async function compareBackendRefs(pool) {
  const refs = collectBackendTableRefs();
  log('\nBackend table reference scan:');
  log(`  distinct .from(...) refs: ${refs.length}`);

  if (!pool) {
    log('  live comparison skipped: DATABASE_URL_OLD or DATABASE_URL is not set');
    return;
  }

  try {
    const result = await pool.query(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      UNION
      SELECT table_name AS name
      FROM information_schema.views
      WHERE table_schema = 'public'
    `);
    const live = new Set(result.rows.map((row) => row.name));
    const missing = refs.filter((name) => !live.has(name));
    log(`  missing live public tables/views: ${missing.length}`);
    if (missing.length) {
      log(`  sample missing refs: ${missing.slice(0, 30).join(', ')}`);
    }
  } catch (error) {
    log(`  live comparison failed: ${error.message}`);
  }
}

async function audit() {
  const oldUrl = process.env.DATABASE_URL_OLD || process.env.DATABASE_URL;
  const newUrl = process.env.DATABASE_URL_NEW;
  log('Clean database rebuild audit');
  log('============================');
  log(`Old DB connection: ${maskConnectionString(oldUrl)}`);
  log(`New DB connection: ${maskConnectionString(newUrl)}`);
  log(`Old Supabase URL:  ${process.env.SUPABASE_OLD_URL ? '(set)' : '(missing)'}`);
  log(`New Supabase URL:  ${process.env.SUPABASE_NEW_URL ? '(set)' : '(missing)'}`);

  summarizeCsvSnapshots();

  const oldPool = createPool(oldUrl, 'old_audit');
  const newPool = createPool(newUrl, 'new_audit');
  await withPool(oldPool, async (pool) => {
    await queryLiveSummary(pool, 'Old/live');
    await compareBackendRefs(pool);
  });
  await withPool(newPool, async (pool) => queryLiveSummary(pool, 'New/target'));

  log('\nDry-run complete. No database changes were made.');
}

async function applySchema() {
  const newUrl = process.env.DATABASE_URL_NEW;
  const sql = fs.readFileSync(schemaFile, 'utf8');
  log('Clean database schema migration');
  log('===============================');
  log(`Schema file: ${schemaFile}`);
  log(`Statements size: ${Buffer.byteLength(sql, 'utf8')} bytes`);
  log(`Target DB: ${maskConnectionString(newUrl)}`);

  if (!execute) {
    log('\nDry-run only. Re-run with --execute to apply this schema to DATABASE_URL_NEW.');
    return;
  }
  if (!newUrl) {
    fail('DATABASE_URL_NEW is required for --execute.');
    return;
  }

  await withPool(createPool(newUrl, 'new_schema'), async (pool) => {
    await pool.query(sql);
    log('\nSchema applied successfully.');
  });
}

async function runEtl() {
  const newUrl = process.env.DATABASE_URL_NEW;
  const files = fs
    .readdirSync(etlDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(etlDir, file));

  log('Clean database ETL');
  log('==================');
  log(`ETL files: ${files.length}`);
  for (const file of files) log(`  - ${path.basename(file)}`);
  log(`Target DB: ${maskConnectionString(newUrl)}`);

  if (!execute) {
    log('\nDry-run only. Re-run with --execute after loading legacy data into legacy_import.');
    return;
  }
  if (!newUrl) {
    fail('DATABASE_URL_NEW is required for --execute.');
    return;
  }

  await withPool(createPool(newUrl, 'new_etl'), async (pool) => {
    for (const file of files) {
      log(`\nRunning ${path.basename(file)}...`);
      await pool.query(fs.readFileSync(file, 'utf8'));
    }
    log('\nETL completed successfully.');
  });
}

async function reconcile() {
  const newUrl = process.env.DATABASE_URL_NEW;
  log('Clean database reconciliation');
  log('=============================');
  log(`Target DB: ${maskConnectionString(newUrl)}`);

  if (!newUrl) {
    log('DATABASE_URL_NEW is not set; reconciliation skipped.');
    return;
  }

  const canonicalTables = [
    'branches',
    'users',
    'inventory_items',
    'inventory_locations',
    'inventory_balances',
    'inventory_movements',
    'pos_outlets',
    'menu_items',
    'pos_outlet_items',
    'purchase_orders',
    'goods_receipts',
    'supplier_invoices',
    'supplier_payments',
    'stock_takes',
    'audit_events',
  ];

  await withPool(createPool(newUrl, 'new_reconcile'), async (pool) => {
    for (const table of canonicalTables) {
      const exists = await pool.query('SELECT to_regclass($1) AS relation', [`public.${table}`]);
      if (!exists.rows[0].relation) {
        log(`  ${table}: missing`);
        continue;
      }
      const count = await pool.query(`SELECT count(*)::int AS count FROM public.${table}`);
      log(`  ${table}: ${count.rows[0].count}`);
    }
  });
}

async function main() {
  if (command === 'audit') return audit();
  if (command === 'apply-schema') return applySchema();
  if (command === 'run-etl') return runEtl();
  if (command === 'reconcile') return reconcile();

  log(`Unknown command: ${command}`);
  log('Usage: node scripts/clean-db-rebuild.js [audit|apply-schema|run-etl|reconcile] [--execute]');
  process.exitCode = 1;
}

main().catch((error) => fail('Clean database rebuild helper failed.', error));
