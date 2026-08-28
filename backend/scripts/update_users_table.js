/**
 * Update Users Table Script
 * 
 * This script updates the users table to include necessary columns for authentication.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function updateUsersTable() {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('Updating users table structure...');

    // Check if users table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    // If users table doesn't exist, create it
    if (!tableExists.rows[0].exists) {
      console.log('Creating users table...');
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          is_central BOOLEAN DEFAULT FALSE,
          department VARCHAR(100),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );
      `);
      return; // Table created with all required columns
    }
    
    // Add all necessary columns if they don't exist
    const requiredColumns = [
      { name: 'password', type: 'TEXT' },
      { name: 'hashed_password', type: 'TEXT' },
      { name: 'account_type', type: 'VARCHAR(20) DEFAULT \'internal\'' },
      { name: 'first_name', type: 'VARCHAR(100) NOT NULL DEFAULT \'User\'' },
      { name: 'last_name', type: 'VARCHAR(100) NOT NULL DEFAULT \'User\'' },
      { name: 'role', type: 'VARCHAR(50) NOT NULL DEFAULT \'employee\'' },
      { name: 'branch_id', type: 'INTEGER REFERENCES branches(id) ON DELETE SET NULL' },
      { name: 'is_central', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'department', type: 'VARCHAR(100)' },
      { name: 'created_at', type: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ' }
    ];
    
    // Check specifically for hashed_password constraint
    const hashedPasswordConstraint = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'hashed_password'
    `);
    
    // If hashed_password exists but is NOT NULL, make it nullable temporarily
    if (hashedPasswordConstraint.rows.length > 0 && hashedPasswordConstraint.rows[0].is_nullable === 'NO') {
      console.log('Modifying hashed_password to be nullable...');
      await client.query(`
        ALTER TABLE users 
        ALTER COLUMN hashed_password DROP NOT NULL;
      `);
    }
    
    for (const column of requiredColumns) {
      const columnExists = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [column.name]);
      
      if (columnExists.rows.length === 0) {
        console.log(`Adding ${column.name} column to users table...`);
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type}
        `);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Users table updated successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating users table:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the script
updateUsersTable().catch(console.error);
