
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

// Data from update_beverage_inventory.js
const beverageData = {
    "Cognac": [
        { name: 'Hennesy 750ml', price: 6500 },
        { name: 'Double Black 1L', price: 7500 },
        { name: 'Martel VS', price: 8500 },
        { name: 'Martel VSOP', price: 13000 },
        { name: 'Singletone 12yrs', price: 6000 }
    ],
    "Whisky": [
        { name: 'B/Whisky 3/4', price: 1300 },
        { name: 'B/Whisky 1/4', price: 450 },
        { name: 'All Seasons 3/4', price: 1500 },
        { name: 'All Seasons 1/2', price: 1100 },
        { name: 'All Seasons 3/4 (Alt)', price: 1900 },
        { name: 'Vat 69 1/2', price: 600 },
        { name: 'Vat 69 3/4', price: 800 },
        { name: 'Bond 7 1/4', price: 1700 },
        { name: 'Bond 7 1/2', price: 2500 },
        { name: 'Bond 7 3/4', price: 3000 },
        { name: 'Grants 3/4', price: 1000 },
        { name: 'Grants 1L', price: 1300 },
        { name: 'Red Label 1/4', price: 2500 },
        { name: 'Red Label 1/2', price: 3000 },
        { name: 'Red Label 3/4', price: 2100 },
        { name: 'Red Label 1L', price: 4000 },
        { name: 'Black Label 1/2', price: 5000 },
        { name: 'Black Label 3/4', price: 3000 },
        { name: 'Black Label 1L', price: 4000 },
        { name: 'J W Blonde', price: 1300 },
        { name: 'Hunters 3/4', price: 500 },
        { name: 'Hunters 1/4', price: 700 },
        { name: 'Hunters 1/2', price: 800 },
        { name: 'B S W 1/2', price: 1500 },
        { name: 'B S W 3/4', price: 350 },
        { name: 'Savanna', price: 6000 },
        { name: 'Tang 10', price: 1200 },
        { name: 'Gordons 1/2', price: 4000 },
        { name: 'JD 3/4', price: 5000 },
        { name: 'JD 1L', price: 2400 },
        { name: 'JD 1/2', price: 4000 },
        { name: 'Jameson 1L', price: 3200 },
        { name: 'Jameson 3/4', price: 1600 },
        { name: 'Jameson 1/2', price: 500 },
        { name: 'C/Morgan 1/4', price: 1300 },
        { name: 'C/Morgan 3/4', price: 1500 },
        { name: 'C/Morgan 3/4 Melon', price: 2500 },
        { name: 'Famous Grouse', price: 1000 },
        { name: 'William Lawsons 1/2', price: 2100 },
        { name: 'William Lawsons 3/4', price: 3000 },
        { name: 'William Lawsons 1 Ltr', price: 400 },
        { name: 'V S A 1/4', price: 1200 },
        { name: 'V & A 3/4', price: 2500 },
        { name: 'Gordons 3/4 (Alt)', price: 2500 }
    ],
    "Wines": [
        { name: 'Cellar Cask', price: 1400 },
        { name: 'Heineken Wine Item', price: 350 },
        { name: '4th Street', price: 1300 },
        { name: 'Casabuena', price: 1100 },
        { name: 'Caprice', price: 1100 },
        { name: 'Four Cousins', price: 1100 },
        { name: 'Kingfisher', price: 1200 },
        { name: 'Amarula 1/2', price: 300 },
        { name: 'Amarula 3/4', price: 1600 },
        { name: 'Baileys 1/2', price: 2500 },
        { name: 'Baileys 3/4', price: 1600 },
        { name: 'Asconi', price: 2800 },
        { name: 'Drotdy', price: 2000 },
        { name: 'Robertson', price: 1300 },
        { name: 'Robertson 2L', price: 2000 }
    ],
    "Energy Drinks": [
        { name: 'Redbull', price: 300 },
        { name: 'Monster', price: 350 }
    ],
    "Beers": [
        { name: 'T. Larger', price: 250 },
        { name: 'T. Cider', price: 300 },
        { name: 'T. Lite', price: 250 },
        { name: 'T. Malt', price: 250 },
        { name: 'Guiness', price: 250 },
        { name: 'Balozi', price: 300 },
        { name: 'Black Ice', price: 250 },
        { name: 'Snapp', price: 250 },
        { name: 'Plisner', price: 250 },
        { name: 'Manyatta', price: 250 },
        { name: 'Guiness Smooth', price: 300 },
        { name: 'Desparado', price: 200 },
        { name: 'Hunters Beer', price: 350 },
        { name: 'Tusker Ndimu', price: 300 },
        { name: 'White Cap', price: 200 },
        { name: 'Tusker Lager', price: 250 }
    ],
    "Canned Beers": [
        { name: 'Guiness Can', price: 300 },
        { name: 'T. Can', price: 300 },
        { name: 'W. Cap Can', price: 270 },
        { name: 'Black Ice Can', price: 250 },
        { name: 'Guarana', price: 250 },
        { name: 'T. Lite Can', price: 300 },
        { name: 'T. Cider Can', price: 300 },
        { name: 'Manyatta Can', price: 300 },
        { name: 'Snapp Can', price: 250 },
        { name: 'Quarana Punch', price: 250 },
        { name: 'Gordons Can', price: 300 },
        { name: 'Faxe Can', price: 400 },
        { name: 'Balozi Can', price: 270 }
    ],
    "Spirits": [
        { name: 'KC 1/4', price: 500 },
        { name: 'KC 1/2', price: 700 },
        { name: 'KC 3/4', price: 1300 },
        { name: 'Vodka 1/4', price: 600 },
        { name: 'Vodka 1/2', price: 800 },
        { name: 'VodkAa 3/4', price: 1700 },
        { name: 'Richot 1/4', price: 600 },
        { name: 'Richot 1/2', price: 800 },
        { name: 'Richot 3/4', price: 1700 },
        { name: 'Gilbeys 1/4', price: 600 },
        { name: 'Gilbeys 1/2', price: 850 },
        { name: 'Gilbeys 3/4', price: 1700 },
        { name: 'Viceroy 1/4', price: 650 },
        { name: 'Viceroy 1/2', price: 900 },
        { name: 'Viceroy 3/4', price: 1800 }
    ],
    "Bar Others": [
        { name: 'Camino', price: 4000 },
        { name: 'Jagermeister', price: 4000 },
        { name: 'Sheridans', price: 6000 },
        { name: 'Bullet Bourbon', price: 5000 },
        { name: 'Trust Classic', price: 50 },
        { name: 'Trust Studded', price: 100 }
    ]
}

async function main() {
    console.log('Populating Restaurant Menu with Bar Items...');

    for (const [catName, items] of Object.entries(beverageData)) {
        console.log(`Processing Category: ${catName}`);
        let catId;
        const { data: existingCat } = await supabase
            .from('restaurant_menu_categories')
            .select('id')
            .ilike('name', catName)
            .single();

        if (existingCat) {
            catId = existingCat.id;
            await supabase.from('restaurant_menu_categories').update({ is_bar: true }).eq('id', catId);
        } else {
            const { data: newCat, error } = await supabase
                .from('restaurant_menu_categories')
                .insert({ name: catName, is_bar: true, is_active: true, sort_order: 100 })
                .select('id')
                .single();
            if (error) { console.error(`Failed to create category ${catName}`, error); continue; }
            catId = newCat.id;
        }

        for (const item of items) {
            if (item.name === 'VodkAa 3/4') item.name = 'Vodka 3/4';
            const { data: existingItem } = await supabase
                .from('restaurant_menu_items')
                .select('id')
                .eq('category_id', catId)
                .ilike('name', item.name)
                .single();

            if (existingItem) {
                await supabase
                    .from('restaurant_menu_items')
                    .update({ price: item.price })
                    .eq('id', existingItem.id);
            } else {
                const { error: insertError } = await supabase
                    .from('restaurant_menu_items')
                    .insert({
                        name: item.name,
                        price: item.price,
                        category_id: catId,
                        description: 'Alcohol',
                        is_available: true,
                        preparation_time: 5
                    });
                if (insertError) console.error(`Failed to insert ${item.name}`, insertError);
            }
        }
    }
    console.log('Population Complete.');
}

main();
