const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyChanges() {
    console.log('Fetching categories...');
    const { data: categories, error: fetchError } = await supabase
        .from('restaurant_menu_categories')
        .select('*');

    if (fetchError) {
        console.error('Error fetching categories:', fetchError);
        return;
    }

    const BAR_KEYWORDS = [
        'beverage', 'drink', 'beer', 'wine', 'cocktail', 'spirit',
        'juice', 'tea', 'coffee', 'water', 'soda', 'shisha',
        'liquor', 'whiskey', 'vodka', 'gin', 'rum', 'brandy', 'tequila'
    ];

    console.log(`Found ${categories.length} categories. Checking for bar matches...`);

    const barCategories = categories.filter(cat =>
        BAR_KEYWORDS.some(k => cat.name.toLowerCase().includes(k))
    );

    console.log(`Found ${barCategories.length} bar categories.`);

    for (const cat of barCategories) {
        console.log(`Updating category: ${cat.name}`);
        const { error: updateError } = await supabase
            .from('restaurant_menu_categories')
            .update({ name: cat.name + ' [BAR]' }) // Temporary rename to test visibility/differentiation
            .eq('id', cat.id);

        if (updateError) console.error(`Error updating ${cat.name}:`, updateError);
    }

    console.log('Update complete.');
}

applyChanges();
