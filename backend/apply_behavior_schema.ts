import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to database...");

    const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260330_02_behavior_intelligence.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing migration schema...");
    await client.query(sql);
    
    // Notify postgREST to reload the schema cache so the tables are usable via API
    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log("Migration applied successfully!");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

applyMigration();
