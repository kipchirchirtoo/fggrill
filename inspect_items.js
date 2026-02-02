const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env from backend/.env
if (fs.existsSync('backend/.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('backend/.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_KEY missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Fetching items from store_items...');
    const { data, error } = await supabase
        .from('store_items')
        .select('item_code, name, category, sku');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Total items found:', data.length);

    // Group by category
    const byCategory = data.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
    }, {});
    console.log('Categories count:', byCategory);

    console.log('\nPotential Bar Items Sample (All beverage category):');
    const bevItems = data.filter(item => item.category?.toLowerCase() === 'beverage');
    bevItems.slice(0, 50).forEach(item => {
        console.log(`[${item.category}] ${item.name} (${item.sku || item.item_code})`);
    });

    console.log('\nItems matching keywords but NOT in beverage category:');
    const barKeywords = ['wine', 'spirit', 'beer', 'whisky', 'whiskey', 'vodka', 'soda', 'liquor', 'rum', 'cognac', 'gin', 'brandy', 'tequila', 'champagne', 'cider', 'juice', 'water', 'tonic'];
    const keywordMatches = data.filter(item => {
        const name = item.name?.toLowerCase() || '';
        const cat = item.category?.toLowerCase() || '';
        return barKeywords.some(kw => name.includes(kw)) && cat !== 'beverage';
    });

    keywordMatches.forEach(item => {
        console.log(`[${item.category}] ${item.name} (${item.sku || item.item_code})`);
    });
}

inspect();
