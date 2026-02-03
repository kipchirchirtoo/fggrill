
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load env vars
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Stock to Import (Opening Balance from 28/01/2026)
const stockData = [
    { name: 'Wheat Flour (Exe)', quantity: 12 },
    { name: 'Wheat Flour (Ajab)', quantity: 2 },
    { name: 'Cooking Oil', quantity: 14 },
    { name: 'Rice', quantity: 4 },
    { name: 'Sugar', quantity: 3 },
    { name: 'Smokies', quantity: 2 },
    { name: 'Ice Cream (Vanilla)', quantity: 12 },
    { name: 'Ice Cream (Strawberry)', quantity: 10 },
    { name: 'Marmalade', quantity: 19 }, // "Maime"
    { name: 'Pens', quantity: 30 }
];

async function run() {
    console.log('Starting Stock Level Import...');
    const dateStr = '2026-01-28'; // Backdated

    for (const entry of stockData) {
        try {
            // 1. Find Item
            const { data: item } = await supabase
                .from('simple_items')
                .select('*')
                .ilike('item_name', entry.name)
                .single();

            if (!item) {
                console.log(`Item not found: ${entry.name}`);
                continue;
            }

            // 2. Update Quantity
            const { error: updateError } = await supabase
                .from('simple_items')
                .update({
                    quantity: entry.quantity,
                    last_updated: new Date().toISOString()
                })
                .eq('sku', item.sku);

            if (updateError) {
                console.error(`Error updating ${entry.name}:`, updateError.message);
                continue;
            }

            // 3. Insert History Log
            // Check if history already exists for this date/reason to avoid duplicates?
            // Assuming clean run.
            const { error: historyError } = await supabase
                .from('stock_history')
                .insert({
                    item_sku: item.sku,
                    change_type: 'IN', // Initial Stock In
                    quantity_change: entry.quantity,
                    previous_quantity: item.quantity || 0,
                    new_quantity: entry.quantity,
                    reason: 'INITIAL_STOCK', // Or 'Manual Log Digitization'
                    notes: `Manual Logbook Digitization (Backdated to ${dateStr})`,
                    created_at: new Date(dateStr).toISOString() // Backdate the log? YES.
                });

            if (historyError) {
                console.error(`Error logging history for ${entry.name}:`, historyError.message);
            } else {
                console.log(`Updated ${entry.name}: Qty ${entry.quantity} [${item.sku}]`);
            }

        } catch (err) {
            console.error(`Error processing ${entry.name}:`, err.message);
        }
    }
    console.log('Stock Import Complete.');
}

run();
