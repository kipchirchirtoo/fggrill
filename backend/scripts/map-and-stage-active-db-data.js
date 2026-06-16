#!/usr/bin/env node

/*
 * Maps non-empty legacy Supabase/Postgres tables and optionally stages their
 * rows into the clean database under legacy_import.raw_* tables.
 *
 * Safety:
 * - Reads from DATABASE_URL_OLD (or DATABASE_URL).
 * - Writes only to DATABASE_URL_NEW legacy_import when --execute is passed.
 * - Never prints connection strings or secrets.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');

dotenv.config({ path: path.join(backendDir, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'map';
const execute = args.includes('--execute');
const replace = args.includes('--replace');
const includeSamples = !args.includes('--no-samples');
const batchSize = Number(args.find((arg) => arg.startsWith('--batch='))?.split('=')[1] || 1000);

const reportPath = path.join(repoRoot, 'docs', 'OLD_DB_ACTIVE_TABLE_DATA_MAP.md');
const jsonPath = path.join(backendDir, 'supabase', 'clean-db', 'active-table-map.json');

function log(message = '') {
  process.stdout.write(`${message}\n`);
}

function fail(message, error) {
  log(`\nERROR: ${message}`);
  if (error && error.message) log(error.message);
  process.exitCode = 1;
}

function createPool(connectionString, label) {
  if (!connectionString) return null;
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 1000,
    max: 4,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
    application_name: `famousgate_active_data_${label}`,
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

function qident(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function classifyTable(tableName) {
  const name = normalize(tableName);
  const rules = [
    {
      domain: 'identity_org',
      targets: ['branches', 'users', 'roles', 'user_branch_roles', 'staff_profiles', 'departments'],
      match: /^(auth_users|users|roles|permissions|staff|staff_profiles|departments|branches|user_|profiles?|employees?)/,
    },
    {
      domain: 'hotel_reception',
      targets: ['guests', 'rooms', 'room_types', 'reservations', 'bookings', 'folios', 'housekeeping_tasks'],
      match: /(guest|room|booking|reservation|folio|housekeeping|maintenance|conference|catering)/,
    },
    {
      domain: 'pos_outlets',
      targets: ['pos_outlets', 'menu_items', 'pos_outlet_items', 'pos_shifts', 'pos_orders', 'pos_order_lines', 'pos_payments'],
      match: /^(pos_|restaurant|bar_|bar$|menu|waiter|kyogong|cashier_station|outlet)/,
    },
    {
      domain: 'inventory_truth',
      targets: ['inventory_items', 'inventory_locations', 'inventory_batches', 'inventory_balances', 'inventory_movements', 'inventory_reservations', 'inventory_alerts'],
      match: /(inventory|stock|simple_items|store_item|branch_stock|central_stock|sku|batch|wastage|spoilage|consumption|department_inventory)/,
    },
    {
      domain: 'procurement_ap',
      targets: ['purchase_orders', 'purchase_order_lines', 'goods_receipts', 'goods_receipt_lines', 'supplier_invoices', 'supplier_payments', 'supplier_ledger'],
      match: /(purchase|po_|_po|supplier|vendor|grn|goods_receipt|payment|invoice)/,
    },
    {
      domain: 'branch_request_flow',
      targets: ['branch_requisitions', 'packing_sessions', 'dispatches', 'receipt_verifications'],
      match: /(requisition|dispatch|packing|receipt_verification|request)/,
    },
    {
      domain: 'department_issue_flow',
      targets: ['department_requests', 'material_issue_notes', 'material_issue_lines'],
      match: /(department_request|department_issue|material_issue|min_|issue_note)/,
    },
    {
      domain: 'production_outlet_stock',
      targets: ['production_recipes', 'production_runs', 'outlet_stock_movements'],
      match: /(production|recipe|assembly|outlet_stock)/,
    },
    {
      domain: 'stock_take',
      targets: ['stock_takes', 'stock_take_lines', 'stock_take_variances'],
      match: /(stock_take|stock_count|variance|count_items)/,
    },
    {
      domain: 'finance_cashier',
      targets: ['cashier_shifts', 'cashier_transactions', 'branch_payments', 'credit_bills', 'bank_accounts', 'bank_reconciliations'],
      match: /(finance|cashier|credit|bank|billing|transaction|mpesa|payroll|salary)/,
    },
    {
      domain: 'audit_governance',
      targets: ['audit_events', 'workflow_tasks', 'documents', 'notifications'],
      match: /(audit|log|notification|document|approval|workflow|void|security|activity)/,
    },
  ];

  const rule = rules.find((candidate) => candidate.match.test(name));
  return rule || { domain: 'legacy_review', targets: [] };
}

async function getColumns(pool) {
  const result = await pool.query(`
    SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const byTable = new Map();
  for (const row of result.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push(row);
  }
  return byTable;
}

async function getPrimaryKeys(pool) {
  const result = await pool.query(`
    SELECT kcu.table_schema, kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.table_name, kcu.ordinal_position
  `);

  const byTable = new Map();
  for (const row of result.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push(row.column_name);
  }
  return byTable;
}

async function getForeignKeys(pool) {
  const result = await pool.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  const byTable = new Map();
  for (const row of result.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push({
      column: row.column_name,
      references: `${row.foreign_table_schema}.${row.foreign_table_name}.${row.foreign_column_name}`,
      constraint: row.constraint_name,
    });
  }
  return byTable;
}

async function exactTableCount(pool, tableName) {
  const result = await pool.query(`SELECT count(*)::bigint AS count FROM public.${qident(tableName)}`);
  return Number(result.rows[0].count);
}

async function getSampleRows(pool, tableName) {
  const result = await pool.query(`
    SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) AS rows
    FROM (
      SELECT to_jsonb(t) AS row_data
      FROM public.${qident(tableName)} AS t
      LIMIT 3
    ) sample
  `);
  return result.rows[0].rows || [];
}

async function buildActiveTableMap(oldPool) {
  const tablesResult = await oldPool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const columns = await getColumns(oldPool);
  const primaryKeys = await getPrimaryKeys(oldPool);
  const foreignKeys = await getForeignKeys(oldPool);

  const active = [];
  for (const table of tablesResult.rows) {
    const count = await exactTableCount(oldPool, table.table_name);
    if (count <= 0) continue;

    const key = `${table.table_schema}.${table.table_name}`;
    const classification = classifyTable(table.table_name);
    active.push({
      table_schema: table.table_schema,
      table_name: table.table_name,
      row_count: count,
      canonical_domain: classification.domain,
      canonical_targets: classification.targets,
      primary_key_columns: primaryKeys.get(key) || [],
      foreign_keys: foreignKeys.get(key) || [],
      columns: columns.get(key) || [],
      sample_rows: includeSamples ? await getSampleRows(oldPool, table.table_name) : [],
    });
    log(`  ${String(active.length).padStart(3, ' ')}. ${table.table_name}: ${count}`);
  }

  active.sort((a, b) => b.row_count - a.row_count || a.table_name.localeCompare(b.table_name));
  return active;
}

function writeReports(activeTables) {
  const domainCounts = new Map();
  for (const table of activeTables) {
    const current = domainCounts.get(table.canonical_domain) || { tables: 0, rows: 0 };
    current.tables += 1;
    current.rows += table.row_count;
    domainCounts.set(table.canonical_domain, current);
  }

  const now = new Date().toISOString();
  const totalRows = activeTables.reduce((sum, table) => sum + table.row_count, 0);
  const md = [
    '# Old Database Active Table Data Map',
    '',
    `Generated: ${now}`,
    '',
    'This report lists only old `public` tables that contain data. It is the migration manifest for staging old rows into the new clean database under `legacy_import`, then transforming them into canonical tables.',
    '',
    '## Summary',
    '',
    `- Active old tables: ${activeTables.length}`,
    `- Active old rows: ${totalRows}`,
    '- Empty old tables: intentionally excluded',
    '- Target staging: `legacy_import.raw_table_manifest` and `legacy_import.raw_rows`',
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Tables | Rows |',
    '| --- | ---: | ---: |',
    ...[...domainCounts.entries()]
      .sort((a, b) => b[1].rows - a[1].rows || a[0].localeCompare(b[0]))
      .map(([domain, counts]) => `| ${domain} | ${counts.tables} | ${counts.rows} |`),
    '',
    '## Active Tables',
    '',
    '| Old table | Rows | Canonical domain | Canonical target candidates | Primary key |',
    '| --- | ---: | --- | --- | --- |',
    ...activeTables.map((table) => {
      const targets = table.canonical_targets.length ? table.canonical_targets.join(', ') : 'manual review';
      const pk = table.primary_key_columns.length ? table.primary_key_columns.join(', ') : '-';
      return `| \`${table.table_name}\` | ${table.row_count} | ${table.canonical_domain} | ${targets} | ${pk} |`;
    }),
    '',
    '## Migration Rule',
    '',
    'Do not recreate these old tables in `public`. Stage the rows into `legacy_import`, then migrate them into canonical domain tables with module ETL scripts. This keeps dirty old schemas out of the new application surface.',
    '',
  ].join('\n');

  fs.writeFileSync(reportPath, md);
  fs.writeFileSync(jsonPath, `${JSON.stringify(activeTables, null, 2)}\n`);

  log(`\nReport written: ${reportPath}`);
  log(`JSON map written: ${jsonPath}`);
}

async function ensureRawStagingTables(newPool) {
  await newPool.query(`
    CREATE SCHEMA IF NOT EXISTS legacy_import;

    CREATE TABLE IF NOT EXISTS legacy_import.raw_table_manifest (
      table_schema text NOT NULL DEFAULT 'public',
      table_name text NOT NULL,
      row_count bigint NOT NULL DEFAULT 0,
      canonical_domain text NOT NULL DEFAULT 'legacy_review',
      canonical_targets text[] NOT NULL DEFAULT '{}',
      primary_key_columns text[] NOT NULL DEFAULT '{}',
      foreign_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
      columns jsonb NOT NULL DEFAULT '[]'::jsonb,
      sample_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_fingerprint text,
      imported_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (table_schema, table_name)
    );

    CREATE TABLE IF NOT EXISTS legacy_import.raw_rows (
      id bigserial PRIMARY KEY,
      table_schema text NOT NULL DEFAULT 'public',
      table_name text NOT NULL,
      source_pk jsonb NOT NULL DEFAULT '{}'::jsonb,
      row_data jsonb NOT NULL,
      row_fingerprint text NOT NULL,
      imported_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (table_schema, table_name, row_fingerprint)
    );

    CREATE INDEX IF NOT EXISTS idx_raw_rows_table
      ON legacy_import.raw_rows (table_schema, table_name);

    CREATE INDEX IF NOT EXISTS idx_raw_rows_source_pk
      ON legacy_import.raw_rows USING gin (source_pk);
  `);
}

function rowFingerprint(tableName, rowData) {
  return crypto
    .createHash('sha256')
    .update(tableName)
    .update('\0')
    .update(JSON.stringify(rowData))
    .digest('hex');
}

function sourcePrimaryKey(rowData, pkColumns) {
  const key = {};
  for (const column of pkColumns) key[column] = rowData[column] ?? null;
  return key;
}

async function upsertManifest(newPool, table) {
  await newPool.query(
    `
      INSERT INTO legacy_import.raw_table_manifest (
        table_schema, table_name, row_count, canonical_domain, canonical_targets,
        primary_key_columns, foreign_keys, columns, sample_rows, source_fingerprint,
        imported_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, now())
      ON CONFLICT (table_schema, table_name) DO UPDATE SET
        row_count = EXCLUDED.row_count,
        canonical_domain = EXCLUDED.canonical_domain,
        canonical_targets = EXCLUDED.canonical_targets,
        primary_key_columns = EXCLUDED.primary_key_columns,
        foreign_keys = EXCLUDED.foreign_keys,
        columns = EXCLUDED.columns,
        sample_rows = EXCLUDED.sample_rows,
        source_fingerprint = EXCLUDED.source_fingerprint,
        imported_at = now()
    `,
    [
      table.table_schema,
      table.table_name,
      table.row_count,
      table.canonical_domain,
      table.canonical_targets,
      table.primary_key_columns,
      JSON.stringify(table.foreign_keys),
      JSON.stringify(table.columns),
      JSON.stringify(table.sample_rows),
      rowFingerprint(table.table_name, {
        row_count: table.row_count,
        columns: table.columns.map((column) => `${column.column_name}:${column.data_type}:${column.udt_name}`),
      }),
    ],
  );
}

async function stageTableRows(oldPool, newPool, table) {
  if (replace) {
    await newPool.query(
      'DELETE FROM legacy_import.raw_rows WHERE table_schema = $1 AND table_name = $2',
      [table.table_schema, table.table_name],
    );
  }

  await upsertManifest(newPool, table);

  let staged = 0;
  for (let offset = 0; offset < table.row_count; offset += batchSize) {
    const result = await oldPool.query(`
      SELECT to_jsonb(t) AS row_data
      FROM public.${qident(table.table_name)} AS t
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);

    const rows = result.rows.map((row) => {
      const rowData = row.row_data || {};
      return {
        table_schema: table.table_schema,
        table_name: table.table_name,
        source_pk: sourcePrimaryKey(rowData, table.primary_key_columns),
        row_data: rowData,
        row_fingerprint: rowFingerprint(table.table_name, rowData),
      };
    });

    if (!rows.length) continue;

    await newPool.query(
      `
        INSERT INTO legacy_import.raw_rows (
          table_schema, table_name, source_pk, row_data, row_fingerprint
        )
        SELECT
          item->>'table_schema',
          item->>'table_name',
          item->'source_pk',
          item->'row_data',
          item->>'row_fingerprint'
        FROM jsonb_array_elements($1::jsonb) AS item
        ON CONFLICT (table_schema, table_name, row_fingerprint) DO NOTHING
      `,
      [JSON.stringify(rows)],
    );

    staged += rows.length;
  }

  return staged;
}

async function stageActiveData(activeTables) {
  const oldUrl = process.env.DATABASE_URL_OLD || process.env.DATABASE_URL;
  const newUrl = process.env.DATABASE_URL_NEW;
  if (!execute) {
    log('\nDry-run only. Re-run with --execute to stage active old rows into DATABASE_URL_NEW.');
    return;
  }
  if (!oldUrl || !newUrl) {
    fail('DATABASE_URL_OLD/DATABASE_URL and DATABASE_URL_NEW are required for staging.');
    return;
  }

  const oldPool = createPool(oldUrl, 'old_stage');
  const newPool = createPool(newUrl, 'new_stage');
  try {
    await ensureRawStagingTables(newPool);
    let total = 0;
    for (const table of activeTables) {
      const staged = await stageTableRows(oldPool, newPool, table);
      total += staged;
      log(`  staged ${staged} rows from ${table.table_name}`);
    }
    log(`\nRaw staging completed. Tables: ${activeTables.length}; rows scanned: ${total}.`);
  } finally {
    await oldPool.end().catch(() => undefined);
    await newPool.end().catch(() => undefined);
  }
}

async function printStagingSummary() {
  const newUrl = process.env.DATABASE_URL_NEW;
  if (!newUrl) {
    log('DATABASE_URL_NEW is not set.');
    return;
  }

  await withPool(createPool(newUrl, 'new_staging_summary'), async (pool) => {
    const exists = await pool.query(`
      SELECT to_regclass('legacy_import.raw_table_manifest') AS manifest,
             to_regclass('legacy_import.raw_rows') AS rows
    `);
    if (!exists.rows[0].manifest || !exists.rows[0].rows) {
      log('Raw staging tables do not exist yet.');
      return;
    }

    const summary = await pool.query(`
      SELECT
        count(*)::int AS tables,
        coalesce(sum(row_count), 0)::bigint AS manifest_rows,
        (SELECT count(*)::bigint FROM legacy_import.raw_rows) AS staged_rows
      FROM legacy_import.raw_table_manifest
    `);
    const domains = await pool.query(`
      SELECT canonical_domain, count(*)::int AS tables, coalesce(sum(row_count), 0)::bigint AS rows
      FROM legacy_import.raw_table_manifest
      GROUP BY canonical_domain
      ORDER BY rows DESC, canonical_domain
    `);
    const row = summary.rows[0];
    log(`Raw staging manifest tables: ${row.tables}`);
    log(`Manifest source rows:        ${row.manifest_rows}`);
    log(`Raw staged rows:             ${row.staged_rows}`);
    log('\nStaged domains:');
    for (const domain of domains.rows) {
      log(`  ${domain.canonical_domain}: ${domain.tables} tables, ${domain.rows} rows`);
    }
  });
}

async function main() {
  if (command === 'summary') return printStagingSummary();

  const oldUrl = process.env.DATABASE_URL_OLD || process.env.DATABASE_URL;
  if (!oldUrl) {
    fail('DATABASE_URL_OLD or DATABASE_URL is required.');
    return;
  }

  log('Old database active table mapper');
  log('================================');
  log(`Command: ${command}`);
  log(`Mode: ${execute ? 'execute' : 'dry-run'}`);
  log(`Replace existing raw rows: ${replace ? 'yes' : 'no'}`);
  log('\nCounting old public tables with data...');

  const activeTables = await withPool(createPool(oldUrl, 'old_map'), buildActiveTableMap);
  writeReports(activeTables);

  if (command === 'stage') {
    await stageActiveData(activeTables);
  } else if (command !== 'map') {
    log(`\nUnknown command: ${command}`);
    log('Usage: node scripts/map-and-stage-active-db-data.js [map|stage|summary] [--execute] [--replace] [--batch=1000]');
    process.exitCode = 1;
  } else {
    log('\nDry-run complete. No target database changes were made.');
  }
}

main().catch((error) => fail('Active data mapping failed.', error));
