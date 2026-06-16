require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  try {
    console.log('Testing stock_counts...');
    const { data, error } = await supabase.from('stock_counts').select('*').limit(1);
    if (error) console.error('stock_counts error:', error.message, error.code);
    else console.log('stock_counts exists, rows:', data.length);
    
    console.log('Testing stock_takes...');
    const { data: d2, error: e2 } = await supabase.from('stock_takes').select('*').limit(1);
    if (e2) console.error('stock_takes error:', e2.message, e2.code);
    else console.log('stock_takes exists, rows:', d2.length);
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
