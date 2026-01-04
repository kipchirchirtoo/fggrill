/**
 * Security Enhancements Migration Script
 * Adds account lockout fields and activity logs table
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
}

console.log('🔌 Connecting to database...');

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('✅ Connected to database');

        // 1. Add account lockout fields to users table
        console.log('👤 Updating users table for account lockout...');
        await client.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP WITH TIME ZONE;
    `);
        console.log('✅ Users table updated');

        // 2. Create activity_logs table
        console.log('📦 Creating activity_logs table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS public.activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          ip TEXT,
          user_agent TEXT,
          payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('✅ Activity logs table created/verified');

        // 3. Create indexes
        console.log('📊 Creating indexes...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);
    `);
        console.log('✅ Indexes created');

        // 4. Enable RLS and set policies
        console.log('🔒 Setting up Row Level Security...');
        await client.query(`
      ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
    `);

        await client.query(`
      DROP POLICY IF EXISTS activity_logs_admin_all ON public.activity_logs;
    `);
        await client.query(`
      CREATE POLICY activity_logs_admin_all ON public.activity_logs 
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager')
        )
      );
    `);
        console.log('✅ RLS policies set');

        // 5. Grant permissions
        console.log('🔑 Granting permissions...');
        await client.query(`
      GRANT ALL ON public.activity_logs TO authenticated;
      GRANT ALL ON public.activity_logs TO service_role;
    `);
        console.log('✅ Permissions granted');

        console.log('');
        console.log('🎉 Security migration completed successfully!');

    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration error:', error);
        process.exit(1);
    });
