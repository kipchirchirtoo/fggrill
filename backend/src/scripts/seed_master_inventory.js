require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const inventoryList = [
    // Vegetables / Produce
    { name: 'Onions', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Tomatoes', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Cabbage', category: 'food', sub_category: 'Vegetables / Produce', unit: 'pieces' },
    { name: 'Sukuma wiki', category: 'food', sub_category: 'Vegetables / Produce', unit: 'packets' },
    { name: 'Sweet potatoes', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Potatoes', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Carrots', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Lemon', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Ginger', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Hoho (capsicum)', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },
    { name: 'Spaghetti', category: 'food', sub_category: 'Vegetables / Produce', unit: 'packets' },
    { name: 'Indomie', category: 'food', sub_category: 'Vegetables / Produce', unit: 'packets' },
    { name: 'Butternut', category: 'food', sub_category: 'Vegetables / Produce', unit: 'pieces' },
    { name: 'Garlic', category: 'food', sub_category: 'Vegetables / Produce', unit: 'kg' },

    // Oil & Food Items
    { name: 'Cooking oil', category: 'food', sub_category: 'Oil & Food Items', unit: 'liters' },
    { name: 'Air freshener', category: 'cleaning_supplies', sub_category: 'Consumables', unit: 'cans' },

    // Non-Consumables / Kitchen & Housekeeping
    { name: 'Bacon', category: 'food', sub_category: 'Perishable Goods', unit: 'kg' }, // Bacon is food
    { name: 'Toilet tissues', category: 'toiletries', sub_category: 'Housekeeping', unit: 'rolls' },
    { name: 'Kitchen rolls', category: 'toiletries', sub_category: 'Housekeeping', unit: 'rolls' },
    { name: 'Cosy/Hanman tissue', category: 'toiletries', sub_category: 'Housekeeping', unit: 'rolls' },
    { name: 'Jumbo tissue', category: 'toiletries', sub_category: 'Housekeeping', unit: 'rolls' },
    { name: 'Serviettes', category: 'toiletries', sub_category: 'Housekeeping', unit: 'packets' },
    { name: 'Hand towels', category: 'linen', sub_category: 'Housekeeping', unit: 'pieces' },
    { name: 'Foil', category: 'kitchen_equipment', sub_category: 'Kitchen Supplies', unit: 'rolls' },
    { name: 'Thermal rolls', category: 'office_supplies', sub_category: 'Stationery', unit: 'rolls' },

    // Soap
    { name: 'Toilet soap', category: 'toiletries', sub_category: 'Soap', unit: 'pieces' },
    { name: 'Hand soap', category: 'toiletries', sub_category: 'Soap', unit: 'liters' },

    // Detergents & Cleaning
    { name: 'Soap', category: 'cleaning_supplies', sub_category: 'Detergents & Cleaning', unit: 'pieces' },
    { name: 'Silver gel', category: 'cleaning_supplies', sub_category: 'Detergents & Cleaning', unit: 'liters' },
    { name: 'Hand wash', category: 'cleaning_supplies', sub_category: 'Detergents & Cleaning', unit: 'liters' },
    { name: 'Glass cleaner', category: 'cleaning_supplies', sub_category: 'Detergents & Cleaning', unit: 'bottles' },

    // Stationery
    { name: 'Ream papers', category: 'office_supplies', sub_category: 'Stationery', unit: 'packets' },
    { name: 'Pens', category: 'office_supplies', sub_category: 'Stationery', unit: 'pieces' },
    { name: 'Note books', category: 'office_supplies', sub_category: 'Stationery', unit: 'pieces' },
    { name: 'Staple pins', category: 'office_supplies', sub_category: 'Stationery', unit: 'boxes' },
    { name: 'Marker pen', category: 'office_supplies', sub_category: 'Stationery', unit: 'pieces' },
    { name: 'Envelope A4 & A5', category: 'office_supplies', sub_category: 'Stationery', unit: 'pieces' },
    { name: 'Thumb tacks', category: 'office_supplies', sub_category: 'Stationery', unit: 'boxes' },

    // Gas
    { name: 'Gas', category: 'maintenance_items', sub_category: 'Gas', unit: 'kg' },

    // Cereals
    { name: 'Maize flour', category: 'food', sub_category: 'Cereals', unit: 'kg' },
    { name: 'Rice', category: 'food', sub_category: 'Cereals', unit: 'kg' },
    { name: 'Sugar', category: 'food', sub_category: 'Cereals', unit: 'kg' },

    // Spices
    { name: 'Coriander', category: 'food', sub_category: 'Spices', unit: 'kg' },
    { name: 'Curry powder', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'Garam masala', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'Black pepper', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'White pepper', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'Fish masala', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'Pilau masala', category: 'food', sub_category: 'Spices', unit: 'packets' },
    { name: 'Chilli powder', category: 'food', sub_category: 'Spices', unit: 'packets' },

    // Spreads
    { name: 'Margarine', category: 'food', sub_category: 'Spreads', unit: 'kg' },
    { name: 'Butter', category: 'food', sub_category: 'Spreads', unit: 'kg' },
    { name: 'Jam', category: 'food', sub_category: 'Spreads', unit: 'cans' },

    // Beverages
    { name: 'Tea leaves', category: 'beverage', sub_category: 'Beverages', unit: 'packets' },
    { name: 'Coffee', category: 'beverage', sub_category: 'Beverages', unit: 'packets' },
    { name: 'Milk', category: 'beverage', sub_category: 'Beverages', unit: 'liters' },

    // Sachets
    { name: 'Sugar sachets', category: 'food', sub_category: 'Sachets', unit: 'packets' },
    { name: 'Salt sachets', category: 'food', sub_category: 'Sachets', unit: 'packets' },
    { name: 'Tomato sauce sachets', category: 'food', sub_category: 'Sachets', unit: 'packets' },

    // Flour
    { name: 'All-purpose flour', category: 'food', sub_category: 'Flour', unit: 'kg' },
    { name: 'Self-raising flour', category: 'food', sub_category: 'Flour', unit: 'kg' },

    // Perishable Goods
    { name: 'Eggs', category: 'food', sub_category: 'Perishable Goods', unit: 'units' },
    { name: 'Chicken', category: 'food', sub_category: 'Perishable Goods', unit: 'kg' },
    { name: 'Sausage', category: 'food', sub_category: 'Perishable Goods', unit: 'packets' },
    { name: 'Smokies', category: 'food', sub_category: 'Perishable Goods', unit: 'packets' },

    // Fruits
    { name: 'Bananas', category: 'food', sub_category: 'Fruits', unit: 'kg' },
    { name: 'Oranges', category: 'food', sub_category: 'Fruits', unit: 'kg' },
    { name: 'Pineapple', category: 'food', sub_category: 'Fruits', unit: 'pieces' },
    { name: 'Watermelon', category: 'food', sub_category: 'Fruits', unit: 'kg' }
];

async function seed() {
    console.log('Starting Master Inventory Seeding...');

    for (const item of inventoryList) {
        // 1. Check if item exists (case-insensitive)
        const { data: existing } = await supabase
            .from('store_items')
            .select('*')
            .ilike('name', `%${item.name}%`)
            .limit(1)
            .single();

        if (existing) {
            console.log(`Updating existing item: ${existing.name}`);
            await supabase
                .from('store_items')
                .update({
                    category: item.category,
                    sub_category: item.sub_category,
                    unit: item.unit
                })
                .eq('id', existing.id);
        } else {
            console.log(`Inserting new item: ${item.name}`);
            // Generate item code if missing
            const itemCode = `ST-${item.name.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

            const { error } = await supabase
                .from('store_items')
                .insert({
                    item_code: itemCode,
                    name: item.name,
                    category: item.category,
                    sub_category: item.sub_category,
                    unit: item.unit,
                    current_stock: 0,
                    minimum_stock: 10,
                    maximum_stock: 200,
                    reorder_level: 20
                });

            if (error) console.error(`Error inserting ${item.name}:`, error);
        }
    }

    console.log('Seeding complete.');
}

seed();
