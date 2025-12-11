/**
 * Script to check enum values in the database
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function checkEnumValues() {
  const client = await pool.connect();
  
  try {
    console.log('Checking enum types in database...');
    
    // Query to list all enum types and their values
    const enumTypes = await client.query(`
      SELECT
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);
    
    // Display the results
    if (enumTypes.rows.length === 0) {
      console.log('No enum types found in the database.');
    } else {
      const enumMap = {};
      
      // Group enum values by type
      enumTypes.rows.forEach(row => {
        if (!enumMap[row.enum_name]) {
          enumMap[row.enum_name] = [];
        }
        enumMap[row.enum_name].push(row.enum_value);
      });
      
      // Print the results
      console.log('Found the following enum types:');
      for (const [enumName, values] of Object.entries(enumMap)) {
        console.log(`- ${enumName}: ${values.join(', ')}`);
      }
    }
    
    // Check account_type column specifically
    const accountTypeCol = await client.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'account_type'
    `);
    
    if (accountTypeCol.rows.length > 0) {
      console.log('\nAccount type column details:');
      console.log(`Data type: ${accountTypeCol.rows[0].data_type}`);
      console.log(`UDT name: ${accountTypeCol.rows[0].udt_name}`);
    } else {
      console.log('\nNo account_type column found in users table.');
    }
    
  } catch (error) {
    console.error('Error checking enum values:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the script
checkEnumValues().catch(console.error);
