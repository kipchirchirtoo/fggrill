require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTable() {
  console.log('Creating petty_cash_transactions table...\n');

  try {
    // Create the table using raw SQL through Supabase's REST API
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS petty_cash_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
          category VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('Step 1: Creating table structure...');
    
    // We'll use fetch directly to call Supabase's SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: createTableSQL })
    });

    if (!response.ok) {
      console.log('Direct SQL execution not available. Using alternative method...\n');
      console.log('⚠️  MANUAL ACTION REQUIRED:');
      console.log('Please run the following SQL in your Supabase SQL Editor:\n');
      console.log('File: backend/supabase/migrations/38_petty_cash_transactions.sql\n');
      console.log('Or copy and paste this SQL:\n');
      console.log(createTableSQL);
      console.log('\nAfter running the SQL, the petty cash request feature will work.');
      return;
    }

    console.log('✅ Table created successfully!\n');

    // Verify
    console.log('Step 2: Verifying table...');
    const { data, error } = await supabase
      .from('petty_cash_transactions')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
    } else {
      console.log('✅ Table verified and accessible!\n');
      console.log('Petty cash request feature is now ready to use.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n⚠️  MANUAL ACTION REQUIRED:');
    console.log('Please run the migration file in Supabase SQL Editor:');
    console.log('File: backend/supabase/migrations/38_petty_cash_transactions.sql');
  }
}

createTable().catch(console.error);
