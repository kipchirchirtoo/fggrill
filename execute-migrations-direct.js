const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Parse Supabase URL to get connection details
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract database connection info from Supabase URL
const supabaseHost = SUPABASE_URL.replace('https://', '').replace('http://', '');
const projectRef = supabaseHost.split('.')[0];

// Supabase PostgreSQL connection details
const connectionString = `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function executeSQLFile(client, filePath, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Executing: ${description}`);
  console.log(`File: ${filePath}`);
  console.log('='.repeat(60));

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Success!');
    return true;
  } catch (error) {
    // Check if error is "already exists" which is OK
    if (error.message.includes('already exists') || 
        error.message.includes('duplicate key') ||
        error.code === '42P07' || // relation already exists
        error.code === '42710') { // object already exists
      console.log('✅ Already exists (OK)');
      return true;
    }
    
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting Direct PostgreSQL Migration Execution\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Project Ref: ${projectRef}`);
  console.log(`Service Role Key: ${SERVICE_ROLE_KEY ? '✓ Present' : '✗ Missing'}\n`);

  if (!SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    const migrations = [
      {
        file: 'backend/supabase/migrations/38_petty_cash_transactions.sql',
        description: 'Petty Cash Transactions Table'
      },
      {
        file: 'backend/supabase/migrations/39_payments_verification_system.sql',
        description: 'Payment Verification System'
      }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const migration of migrations) {
      if (fs.existsSync(migration.file)) {
        const success = await executeSQLFile(client, migration.file, migration.description);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.log(`⚠️  File not found: ${migration.file}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✨ Migrations executed! Features are now active.');
      console.log('\n📋 Next Steps:');
      console.log('1. Petty Cash: Receptionists can now submit requests');
      console.log('2. Payment Verification: Activate enhanced page');
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('\n💡 Note: Direct PostgreSQL connection requires database password.');
    console.log('   Supabase restricts direct connections for security.');
    console.log('   SQL must be run manually in Supabase Dashboard.');
  } finally {
    await client.end();
  }
}

main().catch(console.error);
