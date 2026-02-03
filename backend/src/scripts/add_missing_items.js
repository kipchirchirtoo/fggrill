
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load env vars
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

const itemsToAdd = [
    { name: 'Ice Cream (Vanilla)', category: 'Foodstuffs', unit: 'tin' },
    { name: 'Ice Cream (Strawberry)', category: 'Foodstuffs', unit: 'tin' }
];

function generateProductCode(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
}

const CATEGORY_MAP = { 'Foodstuffs': 'FOOD' };

async function run() {
    console.log('Adding Missing Items...');

    for (const item of itemsToAdd) {
        const categoryCode = 'FOOD';
        const productCode = generateProductCode(item.name);

        const { count } = await supabase.from('simple_items').select('*', { count: 'exact', head: true }).like('sku', `FGH-${categoryCode}%`);
        const serial = (count || 0) + 1;
        const sku = `FGH-${categoryCode}-${productCode}-${String(serial).padStart(4, '0')}`;

        const { data, error } = await supabase.from('simple_items').insert({
            sku: sku,
            item_name: item.name,
            description: item.name,
            category: item.category,
            category_code: categoryCode,
            unit_of_measure: item.unit,
            quantity: 0,
            cost_price: 0,
            retail_price: 0,
            is_active: true,
            last_updated: new Date().toISOString()
        });

        if (error) console.error(error.message);
        else console.log(`Added ${item.name} [${sku}]`);
    }
}

run();
