const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'database', 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `supabase_backup_${timestamp}.sql`);
  const writeStream = fs.createWriteStream(backupFilePath, { encoding: 'utf8' });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  console.log('🚀 Starting Full Database Backup...');
  console.log(`Target: ${backupFilePath}`);

  writeStream.write(`-- FAMOUSGATE HOTEL DATABASE BACKUP\n`);
  writeStream.write(`-- Date: ${new Date().toISOString()}\n`);
  writeStream.write(`-- Source: ${process.env.SUPABASE_PROJECT_URL || 'Supabase Production'}\n\n`);
  writeStream.write(`BEGIN;\n\n`);

  try {
    const client = await pool.connect();
    
    // Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables to backup.`);

    let totalRows = 0;

    for (const table of tables) {
      try {
        const dataRes = await client.query(`SELECT * FROM public."${table}"`);
        const rows = dataRes.rows;
        
        if (rows.length === 0) {
          continue;
        }

        totalRows += rows.length;
        console.log(`  ✓ Backing up ${table} (${rows.length} rows)`);

        writeStream.write(`-- Table: ${table} (${rows.length} rows)\n`);
        
        const columns = Object.keys(rows[0]);
        const colList = columns.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');

          writeStream.write(`INSERT INTO public."${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`);
        }
        writeStream.write(`\n`);
      } catch (tableErr) {
        console.warn(`  ⚠️ Could not export table ${table}:`, tableErr.message);
      }
    }

    writeStream.write(`COMMIT;\n`);
    writeStream.end();

    client.release();
    await pool.end();

    const stats = fs.statSync(backupFilePath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\n🎉 Backup complete!`);
    console.log(`📁 File: ${backupFilePath}`);
    console.log(`📊 Size: ${sizeMb} MB | Total rows exported: ${totalRows.toLocaleString()}`);

    return {
      filePath: backupFilePath,
      sizeMb,
      totalRows,
      tableCount: tables.length
    };
  } catch (err) {
    console.error('❌ Backup failed:', err);
    throw err;
  }
}

createBackup();
