const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Comprehensive beverage inventory from uploaded images - FINAL VERIFIED VERSION
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
    "Soft Drinks": [
        { name: 'Soda 500ml', price: 100 },
        { name: 'H20 1L', price: 100 },
        { name: 'Alvaro Can', price: 200 },
        { name: 'Delmonte', price: 350 },
        { name: 'Lemonade', price: 100 }
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
    "Energy Drinks": [
        { name: 'Redbull', price: 300 },
        { name: 'Monster', price: 350 }
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
    "Others": [
        { name: 'Camino', price: 4000 },
        { name: 'Jagermeister', price: 4000 },
        { name: 'Sheridans', price: 6000 },
        { name: 'Bullet Bourbon', price: 5000 },
        { name: 'Trust Classic', price: 50 },
        { name: 'Trust Studded', price: 100 }
    ]
};

async function updateBeverageInventory() {
    console.log('Starting FINAL beverage inventory update...\n');

    try {
        // Step 1: Backup and analyze current beverage items in master inventory
        console.log('Step 1: Analyzing current beverage inventory in simple_items...');
        const { data: currentItems, error: fetchError } = await supabase
            .from('simple_items')
            .select('*')
            .ilike('category', '%beverage%');

        if (fetchError) throw fetchError;
        console.log(`Found ${currentItems?.length || 0} existing beverage items\n`);

        // Step 2: Delete old beverage items from simple_items - FULL CLEANUP as requested
        console.log('Step 2: Removing old beverage items from simple_items...');
        const { error: deleteError } = await supabase
            .from('simple_items')
            .delete()
            .ilike('category', '%beverage%');

        if (deleteError) throw deleteError;
        console.log('Old beverage items removed from simple_items\n');

        // Step 3: Insert new beverage items into simple_items
        console.log('Step 3: Adding new beverage items to simple_items...');
        const allItems = [];
        const skuSet = new Set();

        for (const [category, items] of Object.entries(beverageData)) {
            for (const item of items) {
                let sku = `FGH-BEV-${item.name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

                let counter = 1;
                let originalSku = sku;
                while (skuSet.has(sku)) {
                    sku = `${originalSku}-${counter}`;
                    counter++;
                }
                skuSet.add(sku);

                allItems.push({
                    sku,
                    item_name: item.name,
                    category: `Beverage - ${category}`,
                    unit_of_measure: 'bottle/can',
                    retail_price: item.price,
                    cost_price: Math.round(item.price * 0.75),
                    description: `${item.name} - Bar Item`,
                    is_active: true
                });
            }
        }

        console.log(`Inserting ${allItems.length} new beverage items into simple_items...`);
        const { data: insertedItems, error: insertError } = await supabase
            .from('simple_items')
            .insert(allItems)
            .select();

        if (insertError) throw insertError;
        console.log(`Successfully added ${insertedItems?.length || 0} items to simple_items\n`);

        // Step 4: Update bar drinks menu
        console.log('Step 4: Updating bar_drinks menu...');

        // 4.1 Ensure categories exist
        const categories = Object.keys(beverageData);
        console.log('Ensuring categories exist in bar_drink_categories...');
        const categoryMap = {};

        for (const catName of categories) {
            let { data: existingCat, error: findCatError } = await supabase
                .from('bar_drink_categories')
                .select('id')
                .ilike('name', catName);

            if (findCatError) throw findCatError;

            if (existingCat && existingCat.length > 0) {
                categoryMap[catName] = existingCat[0].id;
                console.log(`Found existing category: ${catName}`);
            } else {
                console.log(`Creating category: ${catName}`);
                const { data: newCat, error: createCatError } = await supabase
                    .from('bar_drink_categories')
                    .insert({ name: catName, description: `${catName} category` })
                    .select('id')
                    .single();

                if (createCatError) throw createCatError;
                categoryMap[catName] = newCat.id;
            }
        }

        // 4.2 Upsert drinks into bar_drinks
        console.log('Processing drinks for bar_drinks...');
        let updatedCount = 0;
        let insertedCount = 0;

        for (const [category, items] of Object.entries(beverageData)) {
            const categoryId = categoryMap[category];
            for (const item of items) {
                const { data: existingDrink } = await supabase
                    .from('bar_drinks')
                    .select('id')
                    .eq('category_id', categoryId)
                    .ilike('name', item.name)
                    .maybeSingle();

                if (existingDrink) {
                    const { error: updateError } = await supabase
                        .from('bar_drinks')
                        .update({
                            price: item.price,
                            cost_price: Math.round(item.price * 0.75),
                            is_available: true,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingDrink.id);

                    if (!updateError) updatedCount++;
                } else {
                    const { error: insertDrinkError } = await supabase
                        .from('bar_drinks')
                        .insert({
                            category_id: categoryId,
                            name: item.name,
                            description: `${item.name} - Bar Drink`,
                            price: item.price,
                            cost_price: Math.round(item.price * 0.75),
                            unit: item.name.toLowerCase().includes('can') ? 'can' : 'bottle',
                            is_available: true
                        });

                    if (!insertDrinkError) insertedCount++;
                }
            }

            // Mark old items unavailable
            const newNames = items.map(i => i.name.toLowerCase());
            const { data: oldDrinks } = await supabase
                .from('bar_drinks')
                .select('name')
                .eq('category_id', categoryId);

            if (oldDrinks) {
                for (const oldDrink of oldDrinks) {
                    if (!newNames.includes(oldDrink.name.toLowerCase())) {
                        await supabase
                            .from('bar_drinks')
                            .update({ is_available: false })
                            .eq('category_id', categoryId)
                            .eq('name', oldDrink.name);
                    }
                }
            }
        }

        console.log(`✅ FINAL Beverage inventory and bar menu update completed successfully!`);
        console.log(`\nSummary:`);
        console.log(`- Master Inventory (simple_items): ${insertedItems?.length || 0} items updated`);
        console.log(`- Bar Menu (bar_drinks): ${updatedCount} items updated, ${insertedCount} items inserted`);

    } catch (error) {
        console.error('❌ Error updating beverage inventory:', error);
        process.exit(1);
    }
}

updateBeverageInventory();
