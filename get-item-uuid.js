const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getItems() {
    const { data, error } = await supabase
        .from('store_items')
        .select('id, name, item_code')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Items:');
        data.forEach(i => console.log(`  ${i.name} (${i.item_code}): ${i.id}`));
    }
}

getItems();
