import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');
const MIGRATION_FILES = [
  '20260625_unify_inventory_item_links.sql',
  '20260626_fix_bar_sales_stock_decrement.sql',
];

const DATABASE_URL = process.env.DATABASE_URL?.replace(':6543/', ':5432/');

const run = async () => {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  console.log('Using database:', DATABASE_URL.replace(/:\/\/[^:]+:([^@]+)@/, '://***:***@'));
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\nRunning migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`✓ ${file} completed.`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`✗ ${file} failed:`, (err as Error).message);
      client.release();
      await pool.end();
      process.exit(1);
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('\nAll migrations completed successfully.');
  process.exit(0);
};

run();

