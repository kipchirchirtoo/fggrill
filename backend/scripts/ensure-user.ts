
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function ensureUser() {
    const client = await pool.connect();

    try {
        console.log('👤 Ensuring user exists...');

        const email = 'allansamuel571@gmail.com';
        const role = 'super_admin';

        // Check if user exists
        const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (rows.length === 0) {
            console.log('User not found. Creating...');
            // We need a UUID. In a real scenario, this should match Supabase Auth ID.
            // For now, we'll generate one, but this might mismatch if they try to login via Supabase.
            // Ideally we should query Supabase Auth, but we can't easily from here.
            // However, if the user is already logging in, they might have an ID.
            // Let's assume we can just insert into public.users.

            await client.query(`
            INSERT INTO users (id, email, first_name, last_name, role, status)
            VALUES ($1, $2, 'Allan', 'Samuel', $3, 'active')
        `, [uuidv4(), email, role]);
            console.log(`✅ User created with role ${role}`);
        } else {
            console.log(`User found. Updating role to ${role}...`);
            await client.query('UPDATE users SET role = $1 WHERE email = $2', [role, email]);
            console.log(`✅ User role updated to ${role}`);
        }

    } catch (error) {
        console.error('❌ Error ensuring user:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

ensureUser();
