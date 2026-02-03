
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User Provided Categories:
// Foodstuffs, Cereals, Spices, Spread, Beverages, Satches, Flour, Perishable goods, Fruits, Vegetables, Non-consumables, Soap, Detergent, Stationery, Gas, Other

// CATEGORY Mapping (String -> Code) based on sku.service.ts
const CATEGORY_MAP: Record<string, string> = {
    'Foodstuffs': 'FOOD',
    'Cereals': 'CER',
    'Spices': 'SPC',
    'Spread': 'SPD',
    'Beverages': 'BEV',
    'Satches': 'SAT',
    'Flour': 'FLR',
    'Perishable goods': 'PER',
    'Fruits': 'FRU',
    'Vegetables': 'VEG',
    'Non-consumables': 'NON',
    'Soap': 'SOP',
    'Detergent': 'DET',
    'Stationery': 'STN',
    'Gas': 'GAS',
    'Other': 'OTH'
};

const itemsToImport = [
    // A. KITCHEN / FOOD / PERISHABLE
    { name: 'Onions', category: 'Vegetables', unit: 'kg' },
    { name: 'Tomatoes', category: 'Vegetables', unit: 'kg' },
    { name: 'Cabbage', category: 'Vegetables', unit: 'pcs' },
    { name: 'Nduma', category: 'Vegetables', unit: 'kg' },
    { name: 'Sweet Potatoes', category: 'Vegetables', unit: 'kg' },
    { name: 'Potatoes', category: 'Vegetables', unit: 'bag' },
    { name: 'Carrots', category: 'Vegetables', unit: 'kg' },
    { name: 'Lemon', category: 'Vegetables', unit: 'kg' },
    { name: 'Ginger', category: 'Spices', unit: 'kg' },
    { name: 'Hoho', category: 'Vegetables', unit: 'kg' },
    { name: 'Garlic', category: 'Spices', unit: 'kg' },
    { name: 'Butternut', category: 'Vegetables', unit: 'pcs' },
    { name: 'Beetroots', category: 'Vegetables', unit: 'kg' },
    { name: 'Watermelon', category: 'Fruits', unit: 'kg' },
    { name: 'Pawpaw', category: 'Fruits', unit: 'pcs' },
    { name: 'Rice', category: 'Cereals', unit: 'bag' },
    { name: 'Sugar', category: 'Foodstuffs', unit: 'bag' },
    { name: 'Wheat Flour (Exe)', category: 'Flour', unit: 'bales' },
    { name: 'Wheat Flour (Ajab)', category: 'Flour', unit: 'bales' },
    { name: 'Spagetti', category: 'Foodstuffs', unit: 'pkt' },
    { name: 'Indomie', category: 'Foodstuffs', unit: 'pkt' },
    { name: 'Cooking Oil', category: 'Foodstuffs', unit: 'liters' },
    { name: 'Broilers', category: 'Perishable goods', unit: 'pcs' },
    { name: 'Fish', category: 'Perishable goods', unit: 'pcs' },
    { name: 'Sausages', category: 'Perishable goods', unit: 'pkt' },
    { name: 'Smokies', category: 'Perishable goods', unit: 'pkt' },
    { name: 'Tea Leaves', category: 'Beverages', unit: 'pkt' },
    { name: 'Marmalade', category: 'Spread', unit: 'tin' }, // Assumed for Maime if applicable, but user said Other?

    // B. HOUSEKEEPING / SOAP / DETERGENT / NON-CONSUMABLES
    { name: 'Bella Tissues', category: 'Non-consumables', unit: 'bales' },
    { name: 'Kitchen Rolls', category: 'Non-consumables', unit: 'bales' },
    { name: 'Cosy/Hannan Tissue', category: 'Non-consumables', unit: 'bales' },
    { name: 'Jumbo Tissue', category: 'Non-consumables', unit: 'bales' },
    { name: 'Serviettes', category: 'Non-consumables', unit: 'pkt' },
    { name: 'Hand Towels', category: 'Non-consumables', unit: 'pkt' },
    { name: 'Cling Film', category: 'Non-consumables', unit: 'roll' },
    { name: 'Aluminium Foil', category: 'Non-consumables', unit: 'roll' },
    { name: 'Toilet Soap', category: 'Soap', unit: 'pcs' },
    { name: 'Bar Soap', category: 'Soap', unit: 'pcs' },
    { name: 'Hand Wash', category: 'Soap', unit: 'liters' },
    { name: 'Harpic', category: 'Detergent', unit: 'btl' },
    { name: 'Vim', category: 'Detergent', unit: 'tin' },
    { name: 'Jik', category: 'Detergent', unit: 'btl' },
    { name: 'Omo', category: 'Detergent', unit: 'pkt' },
    { name: 'Kitchen Cleaner', category: 'Detergent', unit: 'liters' },
    { name: 'Glass Cleaner', category: 'Detergent', unit: 'liters' },
    { name: 'Toilet Balls', category: 'Detergent', unit: 'pkt' },
    { name: 'Spirit', category: 'Detergent', unit: 'btl' }, // Methylated spirit
    { name: 'Super Brite', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Steelwool', category: 'Non-consumables', unit: 'pkt' },
    { name: 'Scrubber', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Hair Nets', category: 'Non-consumables', unit: 'pkt' },
    { name: 'Moppers', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Buckets', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Baygon', category: 'Non-consumables', unit: 'can' }, // Insecticide
    { name: 'Air Freshner', category: 'Non-consumables', unit: 'can' },

    // C. STATIONERY / OFFICE
    { name: 'Pens', category: 'Stationery', unit: 'pcs' },
    { name: 'Note Books', category: 'Stationery', unit: 'pcs' },
    { name: 'Staple Pins', category: 'Stationery', unit: 'pkt' },
    { name: 'Marker Pen', category: 'Stationery', unit: 'pcs' },
    { name: 'Envelope A4', category: 'Stationery', unit: 'pcs' },
    { name: 'Envelope A5', category: 'Stationery', unit: 'pcs' },
    { name: 'Thumb Tacks', category: 'Stationery', unit: 'pkt' },
    { name: 'Ream Papers', category: 'Stationery', unit: 'ream' },
    { name: 'Thermol Rolls', category: 'Stationery', unit: 'roll' },

    // D. BAR / DISPOSABLES (Also Non-consumables?)
    { name: 'Take Away Tins', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Take Away Forks', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Take Away Spoons', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Tumblers', category: 'Non-consumables', unit: 'pcs' },
    { name: 'Straws', category: 'Non-consumables', unit: 'pkt' },
    { name: 'Brown Khakis 5', category: 'Non-consumables', unit: 'pcs' }, // Packing

    // E. GAS / FUEL
    { name: 'Gas', category: 'Gas', unit: 'cyl' },
    { name: 'Charcoal', category: 'Gas', unit: 'sack' },

    // F. OTHER
    { name: 'Mara Moja', category: 'Other', unit: 'strip' },
    { name: 'Maime', category: 'Other', unit: 'pcs' },
    { name: 'Sweets', category: 'Foodstuffs', unit: 'pkt' },
];

// Helper to sanitize name for SKU
function generateProductCode(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
}

// Helper to get next serial (simplified)
async function getNextSerial(categoryCode: string) {
    // Check max serial in DB roughly or rely on random/timestamp if needed?
    // Proper way: Check sku_categories
    const { data } = await supabase.from('sku_categories').select('current_serial').eq('code', categoryCode).single();
    let serial = 1;
    if (data) {
        const { error } = await supabase.rpc('increment_sku_serial', { p_category_code: categoryCode });
        // If rpc exists, use it. If not, manual update.
        if (error) {
            // Fallback manual update
            serial = (data.current_serial || 0) + 1;
            await supabase.from('sku_categories').update({ current_serial: serial }).eq('code', categoryCode);
        } else {
            // Fetch again? or assume +1?
            const { data: newData } = await supabase.from('sku_categories').select('current_serial').eq('code', categoryCode).single();
            serial = newData?.current_serial || 1;
        }
    } else {
        // Create category
        await supabase.from('sku_categories').insert({ code: categoryCode, name: categoryCode, current_serial: 1 });
    }
    return serial;
}

async function run() {
    console.log('Starting Import...');

    for (const item of itemsToImport) {
        // 1. Check if exists by name
        const { data: existing } = await supabase
            .from('simple_items')
            .select('sku')
            .ilike('item_name', item.name)
            .single();

        if (existing) {
            console.log(`Skipping ${item.name} (Exists: ${existing.sku})`);
            continue;
        }

        // 2. Generate SKU
        const categoryCode = CATEGORY_MAP[item.category] || 'OTH';
        const productCode = generateProductCode(item.name);

        // Get serial - simplified random for script to avoid race conditions/complexity without full service
        // Actually, let's try to query current count using count query as serial?
        const { count } = await supabase.from('simple_items').select('*', { count: 'exact', head: true }).like('sku', `FGH-${categoryCode}%`);
        const serial = (count || 0) + 1;

        const sku = `FGH-${categoryCode}-${productCode}-${String(serial).padStart(4, '0')}`;

        // 3. Insert
        const { error } = await supabase.from('simple_items').insert({
            sku: sku,
            item_name: item.name,
            category: item.category, // Store the FULL String Category name
            category_code: categoryCode,
            unit_of_measure: item.unit,
            quantity: 0, // Initial stock 0
            cost_price: 0,
            is_active: true,
            last_updated: new Date().toISOString()
        });

        if (error) {
            console.error(`Error inserting ${item.name}:`, error.message);
        } else {
            console.log(`Added ${item.name} [${sku}]`);
        }
    }

    console.log('Import Complete.');
}

run();
