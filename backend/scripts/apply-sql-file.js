#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const relativePath = process.argv[2];

async function main() {
  if (!relativePath) {
    throw new Error('Usage: node scripts/apply-sql-file.js <relative-sql-path>');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  const fullPath = path.resolve(__dirname, '..', relativePath);
  if (!fullPath.startsWith(path.resolve(__dirname, '..'))) {
    throw new Error('SQL path must stay inside backend/');
  }
  const sql = fs.readFileSync(fullPath, 'utf8');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`applied ${relativePath}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('apply_failed', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
  });
  process.exitCode = 1;
});
