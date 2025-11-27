const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Running migrations for Famous Gate Hotel Inventory System...');

    // Get all SQL files from migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrations = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migration of migrations) {
      try {
        console.log(`Running migration: ${migration}`);
        const sql = fs.readFileSync(
          path.join(__dirname, '..', 'migrations', migration),
          'utf8'
        );

        await client.query(sql);
        console.log(`✅ Successfully executed ${migration}`);
      } catch (err) {
        console.error(`❌ Error processing ${migration}:`, err);
        throw err;
      }
    }

    console.log('✨ All migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
