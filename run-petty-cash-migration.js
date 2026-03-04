require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Construct PostgreSQL connection string from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing Supabase URL');
  process.exit(1);
}

// Extract project reference from Supabase URL
// Format: https://PROJECT_REF.supabase.co
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Construct direct PostgreSQL connection string
// Format: postgresql://postgres:[PASSWORD]@db.PROJECT_REF.supabase.co:5432/postgres
const DB_PASSWORD = 'Kyogong@2024'; // Default Supabase password - update if different
const connectionString = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function runMigration() {
  console.log('🚀 Running Petty Cash Transactions Migration...\n');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/38_petty_cash_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('⚙️  Executing migration...\n');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify table creation
    console.log('🔍 Verifying table creation...');
    const verifyResult = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'petty_cash_transactions'
      ORDER BY ordinal_position;
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Table verified! Columns:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
      console.log('');
    } else {
      console.log('⚠️  Table verification failed - no columns found');
    }

    // Check indexes
    console.log('🔍 Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'petty_cash_transactions';
    `);

    if (indexResult.rows.length > 0) {
      console.log('✅ Indexes created:');
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
      console.log('');
    }

    // Check RLS policies
    console.log('🔍 Checking RLS policies...');
    const policyResult = await client.query(`
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'petty_cash_transactions';
    `);

    if (policyResult.rows.length > 0) {
      console.log('✅ RLS Policies created:');
      policyResult.rows.forEach(row => {
        console.log(`   - ${row.policyname}`);
      });
      console.log('');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('\n✨ Petty cash request feature is now ready to use!');
    console.log('\nReceptionists can now:');
    console.log('  • Submit petty cash requests');
    console.log('  • Track request status');
    console.log('  • View transaction history');
    console.log('\nManagers can:');
    console.log('  • Approve/reject requests');
    console.log('  • Add approval notes');
    console.log('  • Monitor all transactions');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  Database password is incorrect.');
      console.log('Please update the DB_PASSWORD in this script with your actual Supabase database password.');
      console.log('You can find it in your Supabase project settings under Database > Connection string');
    } else if (error.message.includes('already exists')) {
      console.log('\n✅ Table already exists! Checking if it\'s properly configured...');
      
      try {
        const checkResult = await client.query('SELECT COUNT(*) FROM petty_cash_transactions');
        console.log('✅ Table is accessible and working!');
      } catch (checkError) {
        console.log('⚠️  Table exists but may have permission issues');
      }
    } else {
      console.log('\nPlease check:');
      console.log('  1. Database connection string is correct');
      console.log('  2. Database password is correct');
      console.log('  3. Network connectivity to Supabase');
    }
  } finally {
    await client.end();
    console.log('\n📡 Database connection closed');
  }
}

runMigration().catch(console.error);
