require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL() {
  console.log('Creating payment_verifications table...\n');

  const sql = fs.readFileSync('CREATE_PAYMENT_VERIFICATION_TABLE.sql', 'utf8');
  
  // Split by semicolon and run each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (!statement) continue;
    
    console.log(`Running statement ${i + 1}/${statements.length}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement
      });

      if (error) {
        console.error(`❌ Error:`, error.message);
        
        // Try direct query as fallback
        console.log('Trying direct query...');
        const { error: directError } = await supabase.from('_sql').select('*').limit(0);
        
        if (directError) {
          console.error('Direct query also failed. Please run this SQL manually in Supabase Dashboard:');
          console.log('\n' + statement + ';\n');
        }
      } else {
        console.log(`✅ Success`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
      console.log('\nPlease run this SQL manually in Supabase Dashboard:');
      console.log('\n' + statement + ';\n');
    }
  }

  // Verify table was created
  console.log('\nVerifying table creation...');
  const { data, error } = await supabase
    .from('payment_verifications')
    .select('*')
    .limit(0);

  if (error) {
    console.error('❌ Table verification failed:', error.message);
    console.log('\n⚠️  MANUAL ACTION REQUIRED:');
    console.log('Please run CREATE_PAYMENT_VERIFICATION_TABLE.sql in Supabase Dashboard SQL Editor');
  } else {
    console.log('✅ Table created successfully!');
  }
}

runSQL().catch(console.error);
