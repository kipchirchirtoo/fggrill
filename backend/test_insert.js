
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('--- Testing stock_count_items insert ---');

    // 1. Get the existing audit ID
    const { data: audit , error } = await supabase.from('stock_counts').select('id').limit(1).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (!audit) {
        console.error('No audit found to test with');
        return;
    }

    // 2. Try to insert an item with a random UUID (should fail if FK exists)
    const randomId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase.from('stock_count_items').insert([{
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
        stock_count_id: audit.id,
        item_id: randomId,
        system_quantity: 0,
        physical_quantity: 0,
        unit_cost: 0
    }]);

    if (error) {
        console.log('Insert failed (Expected if FK active):', error.message);
        if (error.details) console.log('Details:', error.details);
        if (error.hint) console.log('Hint:', error.hint);
    } else {
        console.log('Insert succeeded! No FK constraint on item_id.');
        // Clean up
        const { error } = await supabase.from('stock_count_items').delete().eq('item_id', randomId);
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
    }
}

testInsert().catch(console.error);
