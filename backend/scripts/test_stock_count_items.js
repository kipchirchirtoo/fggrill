require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  try {
    console.log('Testing stock_count_items...');
    const { data, error } = await supabase.from('stock_count_items').select('*').limit(1);
    if (error) console.error('stock_count_items error:', error.message, error.code);
    else console.log('stock_count_items exists, rows:', data.length);
    
    console.log('Testing stock_take_items...');
    const { data: d2, error: e2 } = await supabase.from('stock_take_items').select('*').limit(1);
    if (e2) console.error('stock_take_items error:', e2.message, e2.code);
    else console.log('stock_take_items exists, rows:', d2.length);
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
