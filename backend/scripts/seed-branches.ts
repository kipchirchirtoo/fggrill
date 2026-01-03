
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

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

async function seedBranches() {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting Branches Seeding...');
        await client.query('BEGIN');

        // 1. Create Table if it doesn't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        is_main_branch BOOLEAN DEFAULT false,
        phone VARCHAR(50),
        email VARCHAR(255),
        manager_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // 2. Check existing branches
        const { rows: count } = await client.query('SELECT COUNT(*) FROM branches');
        if (parseInt(count[0].count) === 0) {
            console.log('Seeding branches...');

            await client.query(`
            INSERT INTO branches (id, name, location, status, is_main_branch, phone, email)
            VALUES 
            (1, 'Main Branch', 'Nairobi CBD', 'active', true, '+254700000001', 'main@fggrill.com'),
            (2, 'Westlands Branch', 'Westlands', 'active', false, '+254700000002', 'westlands@fggrill.com'),
            (3, 'Karen Branch', 'Karen', 'active', false, '+254700000003', 'karen@fggrill.com'),
            (4, 'Mombasa Branch', 'Mombasa', 'active', false, '+254700000004', 'mombasa@fggrill.com')
            ON CONFLICT (id) DO NOTHING
        `);

            // Reset sequence to avoid collisions
            await client.query("SELECT setval('branches_id_seq', (SELECT MAX(id) FROM branches))");
        } else {
            console.log('Branches already exist. Skipping seeding.');
        }

        await client.query('COMMIT');
        console.log('✅ Branches Seeding Completed Successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding branches:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

seedBranches();
