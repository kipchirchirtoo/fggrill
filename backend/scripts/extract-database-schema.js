/**
 * Database Schema Extractor Script
 * Connects to Supabase and extracts all tables, columns, and relationships
 * Run with: node scripts/extract-database-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SCHEMA = {
  tables: [],
  relationships: [],
  enums: []
};

async function extractSchema() {
  console.log('🔍 Extracting database schema...\n');

  // 1. Get all tables using direct SQL query
  console.log('📋 Extracting tables...');
  
  // Use PostgreSQL connection directly for schema queries
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  });

  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Found ${tablesResult.rows.length} tables\n`);

    for (const tableRow of tablesResult.rows) {
      await extractTableDetails(pool, tableRow.table_name);
    }

    // 2. Get all enums
    console.log('\n📋 Extracting enums...');
    const enumsResult = await pool.query(`
      SELECT e.enumlabel, t.typname
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      ORDER BY t.typname, e.enumsortorder
    `);

    const enumMap = {};
    enumsResult.rows.forEach(row => {
      if (!enumMap[row.typname]) {
        enumMap[row.typname] = [];
      }
      enumMap[row.typname].push(row.enumlabel);
    });

    Object.keys(enumMap).forEach(enumName => {
      SCHEMA.enums.push({
        name: enumName,
        values: enumMap[enumName]
      });
    });

  } catch (error) {
    console.error('Error connecting to database:', error.message);
    console.log('Falling back to Supabase client...');
    
    // Fallback: Use Supabase client with direct table queries
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .order('table_name');

    if (tables) {
      for (const table of tables) {
        await extractTableDetailsSupabase(table.table_name);
      }
    }
  } finally {
    await pool.end();
  }


  // 3. Generate report
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE SCHEMA DOCUMENTATION');
  console.log('='.repeat(80));
  console.log(`Total Tables: ${SCHEMA.tables.length}`);
  console.log(`Total Enums: ${SCHEMA.enums.length}\n`);

  SCHEMA.tables.forEach(table => {
    console.log(`\n📊 Table: ${table.name}`);
    console.log('-'.repeat(80));
    table.columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('ENUMS');
  console.log('='.repeat(80));
  SCHEMA.enums.forEach(enum_ => {
    console.log(`\n🔹 ${enum_.name}`);
    console.log(`   Values: ${enum_.values.join(', ')}`);
  });

  // Save to JSON
  fs.writeFileSync(
    path.join(__dirname, '../database-schema.json'),
    JSON.stringify(SCHEMA, null, 2)
  );

  console.log('\n' + '='.repeat(80));
  console.log(`📄 Schema saved to: backend/database-schema.json`);
  console.log('='.repeat(80));
}

async function extractTableDetails(pool, tableName) {
  try {
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    const tableInfo = {
      name: tableName,
      columns: columnsResult.rows.map(col => ({
        column_name: col.column_name,
        data_type: col.data_type,
        is_nullable: col.is_nullable,
        column_default: col.column_default,
        character_maximum_length: col.character_maximum_length
      }))
    };

    SCHEMA.tables.push(tableInfo);
    console.log(`  ✓ ${tableName} (${columnsResult.rows.length} columns)`);
  } catch (error) {
    console.error(`Error extracting columns for ${tableName}:`, error.message);
  }
}

async function extractTableDetailsSupabase(tableName) {
  const { data: columns, error } = await supabase
    .from('information_schema.columns')
    .select('*')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .order('ordinal_position');

  if (error) {
    console.error(`Error extracting columns for ${tableName}:`, error);
    return;
  }

  const tableInfo = {
    name: tableName,
    columns: columns.map(col => ({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      column_default: col.column_default,
      character_maximum_length: col.character_maximum_length
    }))
  };

  SCHEMA.tables.push(tableInfo);
  console.log(`  ✓ ${tableName} (${columns.length} columns)`);
}

// Helper function to get all tables (create if not exists)
async function createGetAllTablesFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION get_all_tables()
    RETURNS TABLE(table_name TEXT) AS $$
    BEGIN
      RETURN QUERY
      SELECT table_name::TEXT
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await supabase.rpc('exec_sql', { sql: createFunctionSQL }).catch(() => {
    // Function might not exist or we don't have permission, that's okay
  });
}

const fs = require('fs');
const path = require('path');

extractSchema().catch(console.error);
