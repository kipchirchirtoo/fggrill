require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTable() {
  console.log('🚀 Creating payment_verifications table...\n');

  // First, check if table already exists
  console.log('1. Checking if table exists...');
  const { data: existingData, error: checkError } = await supabase
    .from('payment_verifications')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Table already exists!');
    return;
  }

  console.log('Table does not exist, creating it...\n');

  // Create the table using raw SQL through a stored procedure
  // We'll try multiple approaches

  // Approach 1: Direct table creation
  console.log('2. Attempting to create table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS payment_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id INTEGER NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      reference_number VARCHAR(100),
      customer_name VARCHAR(255),
      bill_reference VARCHAR(100),
      bill_id UUID,
      recorded_by UUID NOT NULL,
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      recorder_notes TEXT,
      accountant_verified_by UUID,
      accountant_verified_at TIMESTAMP WITH TIME ZONE,
      accountant_notes TEXT,
      auditor_verified_by UUID,
      auditor_verified_at TIMESTAMP WITH TIME ZONE,
      auditor_notes TEXT,
      auditor_status VARCHAR(20),
      status VARCHAR(30) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Try using the SQL editor endpoint directly
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: createTableSQL })
    });

    if (response.ok) {
      console.log('✅ Table created successfully via RPC!');
    } else {
      throw new Error('RPC method not available');
    }
  } catch (rpcError) {
    console.log('⚠️  RPC method not available, trying alternative...\n');
    
    // Alternative: Try to insert into a non-existent table to trigger creation
    // This won't work, but let's try the migration approach
    console.log('📋 Please run this SQL manually in Supabase Dashboard:\n');
    console.log('=' .repeat(80));
    console.log(createTableSQL);
    console.log('\nGRANT ALL ON payment_verifications TO authenticated;');
    console.log('GRANT ALL ON payment_verifications TO service_role;');
    console.log('GRANT ALL ON payment_verifications TO anon;');
    console.log('\nCREATE INDEX IF NOT EXISTS idx_payment_verifications_branch ON payment_verifications(branch_id);');
    console.log('CREATE INDEX IF NOT EXISTS idx_payment_verifications_status ON payment_verifications(status);');
    console.log('CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_by ON payment_verifications(recorded_by);');
    console.log('CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_at ON payment_verifications(recorded_at DESC);');
    console.log('=' .repeat(80));
    console.log('\n⚠️  COPY THE SQL ABOVE AND RUN IT IN:');
    console.log('   Supabase Dashboard → SQL Editor → New Query → Paste → Run\n');
    return;
  }

  // Grant permissions
  console.log('3. Setting permissions...');
  const permissions = [
    'GRANT ALL ON payment_verifications TO authenticated',
    'GRANT ALL ON payment_verifications TO service_role',
    'GRANT ALL ON payment_verifications TO anon'
  ];

  for (const perm of permissions) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql: perm })
      });
    } catch (err) {
      // Ignore errors
    }
  }

  // Create indexes
  console.log('4. Creating indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_payment_verifications_branch ON payment_verifications(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_verifications_status ON payment_verifications(status)',
    'CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_by ON payment_verifications(recorded_by)',
    'CREATE INDEX IF NOT EXISTS idx_payment_verifications_recorded_at ON payment_verifications(recorded_at DESC)'
  ];

  for (const idx of indexes) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql: idx })
      });
    } catch (err) {
      // Ignore errors
    }
  }

  // Verify table was created
  console.log('\n5. Verifying table creation...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('payment_verifications')
    .select('id')
    .limit(1);

  if (verifyError) {
    console.error('❌ Table verification failed:', verifyError.message);
    console.log('\n⚠️  Please run CREATE_PAYMENT_VERIFICATION_TABLE.sql manually in Supabase Dashboard');
  } else {
    console.log('✅ Table created and verified successfully!\n');
    console.log('🎉 Payment verification system is ready to use!');
  }
}

createTable().catch(err => {
  console.error('❌ Error:', err.message);
  console.log('\n⚠️  Please run CREATE_PAYMENT_VERIFICATION_TABLE.sql manually in Supabase Dashboard');
});
