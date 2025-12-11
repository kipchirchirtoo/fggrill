#!/usr/bin/env node

/**
 * Branch Architecture Migration Script
 * Runs all the necessary migrations to implement multi-branch architecture
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

// Migration file path
const MIGRATION_FILE = './backend/migrations/versions/20251203_enhance_branches_schema.sql';

async function runMigration() {
  console.log('🔄 Starting branch architecture migration...');

  const client = await pool.connect();
  try {
    // Begin transaction
    await client.query('BEGIN');

    // Read and execute migration file
    console.log(`📄 Reading migration file: ${MIGRATION_FILE}`);
    const migration = fs.readFileSync(path.resolve(MIGRATION_FILE), 'utf8');
    
    console.log('🔧 Executing migration...');
    await client.query(migration);
    
    // Seed initial branch data if needed
    await seedInitialData(client);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
    // Additional steps after migration
    await populateUserBranchAccess();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function seedInitialData(client) {
  console.log('🌱 Seeding initial branch data...');
  
  // Check if we need to seed initial branches
  const { rows } = await client.query('SELECT COUNT(*) FROM branches');
  if (parseInt(rows[0].count) === 0) {
    console.log('No branches found, adding initial branch data...');
    
    // Add a central branch if none exists
    await client.query(`
      INSERT INTO branches (name, code, location, address, is_main_branch, branch_type, status, number_of_rooms)
      VALUES ('Famous Gate Bomet', 'FGBOMET', 'Bomet', 'Main Street, Bomet', TRUE, 'hotel', 'active', 100)
    `);
    
    // Add some satellite branches
    await client.query(`
      INSERT INTO branches (name, code, location, address, is_main_branch, branch_type, status, number_of_rooms)
      VALUES 
        ('Famous Gate Kericho', 'FGKRICH', 'Kericho', 'Tea Road, Kericho', FALSE, 'hotel', 'active', 75),
        ('Famous Gate Litein', 'FGLITEIN', 'Litein', 'Central Avenue, Litein', FALSE, 'hotel', 'active', 50)
    `);
  } else {
    console.log(`Found ${rows[0].count} existing branches, skipping seed data.`);
  }
}

async function populateUserBranchAccess() {
  console.log('👥 Populating user branch access records...');
  
  const client = await pool.connect();
  try {
    // Check if we need to populate user branch access
    const { rows } = await client.query('SELECT COUNT(*) FROM user_branch_access');
    
    if (parseInt(rows[0].count) === 0) {
      console.log('No user branch access records found, creating initial assignments...');
      
      // Assign all users to their respective branches
      await client.query(`
        INSERT INTO user_branch_access (user_id, branch_id, is_primary, access_level)
        SELECT id, branch_id, TRUE, 'full' 
        FROM users 
        WHERE branch_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      
      // Grant super_admin and general_manager access to all branches
      const branches = await client.query('SELECT id FROM branches');
      const admins = await client.query(`
        SELECT id FROM users WHERE role IN ('super_admin', 'general_manager')
      `);
      
      for (const admin of admins.rows) {
        for (const branch of branches.rows) {
          await client.query(`
            INSERT INTO user_branch_access (user_id, branch_id, is_primary, access_level)
            VALUES ($1, $2, FALSE, 'full')
            ON CONFLICT DO NOTHING
          `, [admin.id, branch.id]);
        }
      }
      
      console.log('✅ User branch access records created successfully!');
    } else {
      console.log(`Found ${rows[0].count} existing user branch access records, skipping.`);
    }
  } catch (err) {
    console.error('❌ Error populating user branch access:', err);
  } finally {
    client.release();
  }
}

// Run the migration
runMigration().then(() => {
  console.log('🎉 Branch architecture migration completed!');
  console.log('Next steps:');
  console.log('1. Implement Branch Operations Module');
  console.log('2. Create branch context management system');
  console.log('3. Begin user and permission migration');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed with error:', err);
  process.exit(1);
});
