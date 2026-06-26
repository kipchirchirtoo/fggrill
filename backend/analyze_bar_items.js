const { Client } = require('pg');
require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB successfully!');

    // 1. Fetch branch 2 details
    const branchRes = await client.query('SELECT id, name FROM public.branches WHERE id = 2');
    console.log('\n--- Branch 2 ---');
    console.log(branchRes.rows);

    // 2. Fetch POS outlets in branch 2
    const outletsRes = await client.query(`
      SELECT id, name, outlet_type, branch_id, inventory_location_id 
      FROM public.pos_outlets 
      WHERE branch_id = 2
    `);
    console.log('\n--- POS Outlets in Branch 2 ---');
    console.log(outletsRes.rows);

    // 3. Find the main bar inventory location details
    const mainBarOutlet = outletsRes.rows.find(o => o.outlet_type === 'main_bar' || o.name.toLowerCase().includes('main bar'));
    if (!mainBarOutlet) {
      console.log('Error: Could not find main bar POS outlet in branch 2');
      return;
    }
    console.log('\nFound Main Bar POS Outlet:', mainBarOutlet);

    const locationId = mainBarOutlet.inventory_location_id;
    if (locationId) {
      const locRes = await client.query('SELECT * FROM public.inventory_locations WHERE id = $1', [locationId]);
      console.log('Inventory Location for Main Bar:', locRes.rows);
    } else {
      console.log('Warning: Main Bar POS Outlet has no inventory_location_id linked!');
    }

    // 4. Look up items in the database by name or sku pattern
    const itemNames = [
      'Manyatta',
      'Pineapple Punch can',
      'Guarana can',
      'Balozi lager',
      'Guiness',
      'Guinness', // checking both spellings
      'Tusker Lager',
      'White cap lager',
      'Alvaro'
    ];

    console.log('\n--- Searching Inventory Items (inventory_items) ---');
    for (const name of itemNames) {
      const itemRes = await client.query(`
        SELECT id, sku, item_name, category, unit, item_type 
        FROM public.inventory_items 
        WHERE item_name ILIKE $1 OR sku ILIKE $1
      `, [`%${name}%`]);
      console.log(`Query: "${name}" -> Found ${itemRes.rows.length} records:`);
      itemRes.rows.forEach(r => console.log(`  [ii] ID: ${r.id}, SKU: ${r.sku}, Name: ${r.item_name}, Unit: ${r.unit}`));
    }

    console.log('\n--- Searching Bar Drinks (bar_drinks) ---');
    for (const name of itemNames) {
      const drinkRes = await client.query(`
        SELECT id, sku, name, unit, is_available, branch_id
        FROM public.bar_drinks 
        WHERE name ILIKE $1 OR sku ILIKE $1
      `, [`%${name}%`]);
      console.log(`Query: "${name}" -> Found ${drinkRes.rows.length} records:`);
      drinkRes.rows.forEach(r => console.log(`  [bd] ID: ${r.id}, SKU: ${r.sku}, Name: ${r.name}, Branch: ${r.branch_id}, Available: ${r.is_available}`));
    }

    // Let's also inspect currently active stock balances for location
    if (locationId) {
      console.log(`\n--- Inventory Balances at Location ID ${locationId} ---`);
      const balRes = await client.query(`
        SELECT ib.id, ib.item_id, ii.item_name, ii.sku, ib.current_quantity, ib.unit_cost
        FROM public.inventory_balances ib
        JOIN public.inventory_items ii ON ii.id = ib.item_id
        WHERE ib.location_id = $1
      `, [locationId]);
      console.log(`Found ${balRes.rows.length} balances:`);
      balRes.rows.forEach(r => {
        console.log(`  Item: ${r.item_name} (${r.sku}), Qty: ${r.current_quantity}, Cost: ${r.unit_cost}`);
      });
    }

    // Let's inspect pos_outlet_items for the main bar outlet
    console.log(`\n--- POS Outlet Items for Outlet ID ${mainBarOutlet.id} ---`);
    const poiRes = await client.query(`
      SELECT poi.id, poi.sku, poi.item_name, poi.current_stock, poi.source_table
      FROM public.pos_outlet_items poi
      WHERE poi.outlet_id = $1
    `, [mainBarOutlet.id]);
    console.log(`Found ${poiRes.rows.length} items in POS outlet:`);
    poiRes.rows.forEach(r => {
      console.log(`  Name: ${r.item_name} (SKU: ${r.sku}), Stock: ${r.current_stock}, Source: ${r.source_table}`);
    });

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
