const { Client } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n📋 Removing foreign key constraint from users table');
    
    // Step 1: Drop the foreign key constraint
    console.log('\n1️⃣ Dropping foreign key constraint users_id_fkey...');
    await client.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_id_fkey;
    `);
    console.log('✅ Foreign key constraint dropped');

    // Step 2: Verify the change
    console.log('\n2️⃣ Verifying table structure...');
    const result = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      AND conname = 'users_id_fkey';
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ Foreign key constraint successfully removed');
    } else {
      console.log('⚠️  Foreign key constraint still exists');
    }

    // Step 3: Show current constraints
    console.log('\n3️⃣ Current constraints on users table:');
    const constraints = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      ORDER BY conname;
    `);
    
    constraints.rows.forEach(row => {
      const type = {
        'p': 'PRIMARY KEY',
        'f': 'FOREIGN KEY',
        'u': 'UNIQUE',
        'c': 'CHECK'
      }[row.constraint_type] || row.constraint_type;
      console.log(`   ${row.constraint_name}: ${type}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Backend server will restart automatically');
    console.log('   2. Staff creation should now work without FK constraint');
    console.log('   3. Users can be created independently of Supabase Auth');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigration();
