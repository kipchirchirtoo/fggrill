#!/usr/bin/env node

/**
 * Inspect the live PostgreSQL/Supabase schema from DATABASE_URL.
 *
 * Usage:
 *   node scripts/inspect-live-schema.js
 *   node scripts/inspect-live-schema.js restaurant_tables staff_profiles
 *
 * Output:
 *   database-schema.live.json
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const requestedTables = process.argv.slice(2);
const outputPath = path.join(__dirname, '../database-schema.live.json');

if (!databaseUrl) {
  console.error('DATABASE_URL or SUPABASE_DB_URL is required in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const tableFilterSql = requestedTables.length
  ? 'AND c.table_name = ANY($1::text[])'
  : '';
const filterParams = requestedTables.length ? [requestedTables] : [];

async function query(sql, params = filterParams) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function main() {
  const tables = await query(`
    SELECT
      c.table_name,
      obj_description(format('%I.%I', c.table_schema, c.table_name)::regclass, 'pg_class') AS comment
    FROM information_schema.tables c
    WHERE c.table_schema = 'public'
      AND c.table_type = 'BASE TABLE'
      ${tableFilterSql}
    ORDER BY c.table_name
  `);

  const columns = await query(`
    SELECT
      c.table_name,
      c.ordinal_position,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      ${tableFilterSql}
    ORDER BY c.table_name, c.ordinal_position
  `);

  const primaryKeys = await query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
      ${requestedTables.length ? 'AND tc.table_name = ANY($1::text[])' : ''}
    ORDER BY tc.table_name, kcu.ordinal_position
  `);

  const foreignKeys = await query(`
    SELECT
      tc.constraint_name,
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_schema = rc.constraint_schema
      AND tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      ${requestedTables.length ? 'AND (tc.table_name = ANY($1::text[]) OR ccu.table_name = ANY($1::text[]))' : ''}
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `);

  const enums = await pool.query(`
    SELECT
      t.typname AS enum_name,
      e.enumlabel AS enum_value,
      e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);

  const tableMap = new Map(
    tables.map((table) => [
      table.table_name,
      {
        name: table.table_name,
        comment: table.comment,
        columns: [],
        primaryKey: [],
        foreignKeys: [],
        referencedBy: [],
      },
    ])
  );

  for (const column of columns) {
    const table = tableMap.get(column.table_name);
    if (!table) continue;
    table.columns.push({
      name: column.column_name,
      type: column.data_type === 'USER-DEFINED' ? column.udt_name : column.data_type,
      nullable: column.is_nullable === 'YES',
      default: column.column_default,
      maxLength: column.character_maximum_length,
      numericPrecision: column.numeric_precision,
      numericScale: column.numeric_scale,
    });
  }

  for (const pk of primaryKeys) {
    tableMap.get(pk.table_name)?.primaryKey.push(pk.column_name);
  }

  for (const fk of foreignKeys) {
    const relationship = {
      constraint: fk.constraint_name,
      sourceTable: fk.source_table,
      sourceColumn: fk.source_column,
      targetTable: fk.target_table,
      targetColumn: fk.target_column,
      updateRule: fk.update_rule,
      deleteRule: fk.delete_rule,
      supabaseHint: `${fk.target_table}!${fk.constraint_name}`,
    };

    tableMap.get(fk.source_table)?.foreignKeys.push(relationship);
    tableMap.get(fk.target_table)?.referencedBy.push(relationship);
  }

  const enumMap = new Map();
  for (const row of enums.rows) {
    if (!enumMap.has(row.enum_name)) enumMap.set(row.enum_name, []);
    enumMap.get(row.enum_name).push(row.enum_value);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'live database metadata',
    filters: requestedTables,
    tables: [...tableMap.values()],
    enums: [...enumMap.entries()].map(([name, values]) => ({ name, values })),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Inspected ${report.tables.length} tables and ${foreignKeys.length} foreign-key relationships.`);
  console.log(`Saved live schema report to ${path.relative(process.cwd(), outputPath)}`);

  if (requestedTables.length) {
    for (const table of report.tables) {
      console.log(`\n${table.name}`);
      console.log(`  columns: ${table.columns.map((column) => column.name).join(', ')}`);
      console.log(
        `  foreign keys: ${
          table.foreignKeys
            .map((fk) => `${fk.sourceColumn} -> ${fk.targetTable}.${fk.targetColumn} (${fk.constraint})`)
            .join('; ') || 'none'
        }`
      );
      console.log(
        `  referenced by: ${
          table.referencedBy
            .map((fk) => `${fk.sourceTable}.${fk.sourceColumn} -> ${fk.targetColumn} (${fk.constraint})`)
            .join('; ') || 'none'
        }`
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
