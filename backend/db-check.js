const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const id = '36053b04-1fc4-475f-a286-049fec61ad26';
    const results = { id };

    const { data: main } = await supabase.from('stock_counts').select('*').eq('id', id).single();
    results.main = main;

    const { data: d1 } = await supabase.from('stock_count_items').select('*').eq('stock_count_id', id);
    results.stock_count_items_count = d1?.length || 0;

    const { data: d2 } = await supabase.from('stock_take_items').select('*').eq('stock_take_id', id);
    results.stock_take_items_by_uuid_count = d2?.length || 0;

    if (main && main.take_number) {
        const { data: d3 } = await supabase.from('stock_take_items').select('*').eq('stock_take_id', main.take_number);
        results.stock_take_items_by_take_number_count = d3?.length || 0;
    }

    // Check ALL items in stock_take_items to see if any exist at all
    const { data: allItems } = await supabase.from('stock_take_items').select('*').limit(5);
    results.sample_legacy_items = allItems;

    fs.writeFileSync('db-results.json', JSON.stringify(results, null, 2));
    console.log('Results written to db-results.json');
}

check();
