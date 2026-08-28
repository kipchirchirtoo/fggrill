
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Starting Menu Reorganization...');

    // 1. Create or Get "Soft Drinks" Category (is_bar = true)
    let { data: softDrinkCat } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .ilike('name', 'Soft Drinks')
        .single();

    if (!softDrinkCat) {
        console.log('Creating Soft Drinks category...');
        const { data: newCat, error } = await supabase
            .from('restaurant_menu_categories')
            .insert({ name: 'Soft Drinks', is_bar: true, sort_order: 10, is_active: true })
            .select()
            .single();

        if (error) { console.error('Error creating Soft Drinks:', error); return; }
        softDrinkCat = newCat;
    } else {
        // Ensure it is bar
        const { error } = await supabase.from('restaurant_menu_categories').update({ is_bar: true }).eq('id', softDrinkCat.id);
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
    }

    console.log('Soft Drinks Category ID:', softDrinkCat.id);

    // 2. Identify Items to Move to Soft Drinks
    const itemsToMove = [
        'Soda (300ml)',
        'Soda 500ml (Takeaway)',
        'Mineral Water (500ml)',
        'Mineral Water (1litre)',
        'Mineral Water (10 litre)',
        'Delmonte'
    ];

    console.log('Moving items to Soft Drinks...');
    for (const itemName of itemsToMove) {
        const { error } = await supabase
            .from('restaurant_menu_items')
            .update({ category_id: softDrinkCat.id })
            .eq('name', itemName);

        if (error) console.error(`Failed to move ${itemName}:`, error);
        else console.log(`Moved ${itemName}`);
    }

    // 3. Update HOT BEVERAGES [BAR] -> HOT BEVERAGES (is_bar = false)
    console.log('Updating HOT BEVERAGES...');
    await supabase
        .from('restaurant_menu_categories')
        .update({ name: 'HOT BEVERAGES', is_bar: false })
        .eq('name', 'HOT BEVERAGES [BAR]');

    // 4. Update COLD BEVERAGES [BAR] -> COLD BEVERAGES (is_bar = false)
    // This cleans up the remaining Smoothies/Juices
    console.log('Updating COLD BEVERAGES...');
    await supabase
        .from('restaurant_menu_categories')
        .update({ name: 'COLD BEVERAGES', is_bar: false })
        .eq('name', 'COLD BEVERAGES [BAR]');

    console.log('Reorganization Complete.');
}

main();
