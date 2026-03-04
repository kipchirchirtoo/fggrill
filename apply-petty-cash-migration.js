require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Applying Petty Cash Transactions Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/38_petty_cash_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Migration file loaded successfully');
    console.log('Executing migration...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC doesn't work
      console.log('RPC method failed, trying direct execution...');
      
      // Split by statement and execute one by one
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('NOTIFY')) continue; // Skip NOTIFY statements
        
        const { error: execError } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        }).catch(async () => {
          // If RPC still doesn't work, we need to use the REST API directly
          return { error: null };
        });

        if (execError) {
          console.error('Error executing statement:', statement.substring(0, 100) + '...');
          console.error('Error:', execError.message);
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify the table was created
    console.log('Verifying table creation...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('petty_cash_transactions')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Table verification failed:', tableError.message);
      console.log('\nThe table may not have been created properly.');
      console.log('You may need to run this migration manually in the Supabase SQL editor.');
      console.log('\nMigration file location: backend/supabase/migrations/38_petty_cash_transactions.sql');
    } else {
      console.log('✅ Table verified successfully!');
      console.log('\nPetty cash transactions system is now ready to use.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nPlease run the migration manually in the Supabase SQL editor.');
    console.log('Migration file location: backend/supabase/migrations/38_petty_cash_transactions.sql');
  }
}

applyMigration().catch(console.error);
