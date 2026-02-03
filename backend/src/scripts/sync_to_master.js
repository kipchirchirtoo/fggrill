require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORY_MAP = {
    'Foodstuffs': 'food',
    'Beverages': 'beverage',
    'Toiletries': 'toiletries',
    'Linen': 'linen',
    'Stationery & Office': 'office_supplies',
    'Cleaning Supplies': 'cleaning_supplies',
    'Maintenance': 'maintenance_items',
    'Kitchen Equipment': 'kitchen_equipment',
    'Amenities/Guest': 'amenities',
    'Other': 'other'
};

const UNIT_MAP = {
    'kg': 'kg',
    'Kilograms (kg)': 'kg',
    'liters': 'liters',
    'Liters (L)': 'liters',
    'packets': 'packets',
    'Packets': 'packets',
    'bottles': 'bottles',
    'Bottles': 'bottles',
    'units': 'units',
    'Units': 'units',
    'tin': 'cans',
    'PCs': 'pieces',
    'rolls': 'rolls'
};

async function sync() {
    console.log('Starting sync from simple_items to store_items...');

    // 1. Fetch all simple_items
    const { data: simpleItems, error: fetchError } = await supabase
        .from('simple_items')
        .select('*')
        .eq('is_active', true);

    if (fetchError) {
        console.error('Error fetching simple_items:', fetchError);
        return;
    }

    console.log(`Found ${simpleItems.length} items to sync.`);

    for (const item of simpleItems) {
        // Determine category enum
        let category = CATEGORY_MAP[item.category] || 'other';
        // Fallback for partial matches
        if (category === 'other' && item.category) {
            const lowerCat = item.category.toLowerCase();
            if (lowerCat.includes('food')) category = 'food';
            else if (lowerCat.includes('bev') || lowerCat.includes('drink')) category = 'beverage';
            else if (lowerCat.includes('clean')) category = 'cleaning_supplies';
            else if (lowerCat.includes('stat') || lowerCat.includes('pen')) category = 'office_supplies';
        }

        // Determine unit enum
        let unit = UNIT_MAP[item.unit_of_measure] || 'units';

        // 2. Upsert into store_items
        const { data: existing, error: checkError } = await supabase
            .from('store_items')
            .select('id')
            .eq('sku', item.sku)
            .maybeSingle();

        const reorderLevel = item.reorder_level || 0;
        const maxStock = Math.max(reorderLevel * 10, 100);

        const itemData = {
            item_code: item.sku, // Use SKU as item_code for consistency
            sku: item.sku,
            name: item.item_name,
            description: item.description || item.item_name,
            category: category,
            unit: unit,
            current_stock: item.quantity || 0,
            minimum_stock: 0,
            maximum_stock: maxStock,
            reorder_level: reorderLevel,
            unit_cost: item.cost_price || 0,
            average_cost: item.cost_price || 0,
            last_purchase_cost: item.cost_price || 0,
            is_active: true,
            updated_at: new Date().toISOString()
        };

        if (existing) {
            const { error: updateError } = await supabase
                .from('store_items')
                .update(itemData)
                .eq('id', existing.id);

            if (updateError) console.error(`Failed to update ${item.sku}:`, updateError.message);
            else console.log(`Updated ${item.sku}`);
        } else {
            const { error: insertError } = await supabase
                .from('store_items')
                .insert({
                    ...itemData,
                    created_at: new Date().toISOString()
                });

            if (insertError) console.error(`Failed to insert ${item.sku}:`, insertError.message);
            else console.log(`Inserted ${item.sku}`);
        }
    }

    console.log('Sync complete.');
}

sync();
