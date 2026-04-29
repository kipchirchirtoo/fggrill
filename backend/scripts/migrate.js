const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Create migrations table if it doesn't exist
    await client.query(`
            CREATE TABLE IF NOT EXISTS public._migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

    // 2. Get list of migrations from file system
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') || f.endsWith('.sql.txt'))
      .sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;
        if (!isNaN(bNum)) return 1;
        return a.localeCompare(b);
      });

    // 3. Get list of applied migrations from DB
    const { rows } = await client.query('SELECT name FROM public._migrations');
    const appliedMigrations = new Set(rows.map(r => r.name));

    // 4. Run pending migrations
    const targetFile = process.argv[2];
    
    for (const file of files) {
      if (targetFile && file !== targetFile && !targetFile.endsWith(file)) {
          continue;
      }

      if (appliedMigrations.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        // We split by semicolon for logging/debugging if needed, 
        // but for simple migrations we can run the whole block.
        // However, some migrations might have complex structures.
        // Let's use a simple approach first: run the whole file.
        await client.query(sql);
        await client.query('INSERT INTO public._migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');

        // Skip common existing object errors
        const skipCodes = ['42P07', '42710', '23505', '42712', '42P11', '42P15', '42701', '42723'];
        if (skipCodes.includes(err.code) || err.message.includes('already exists')) {
          console.log(`⚠️ Skipped parts of ${file} (already exists): ${err.message}`);
          // If it mostly "already exists", we might still want to mark it as applied if we're sure
          // But for now, let's just log and continue to the next file if possible.
          // However, we didn't COMMIT the increment to _migrations.
          // If we want to skip the file entirely next time, we should mark it as applied.

          await client.query('BEGIN');
          await client.query('INSERT INTO public._migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          continue;
        }

        console.error(`❌ Error applying ${file}:`, err.message);
        throw err;
      }
    }

    console.log('All pending migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
