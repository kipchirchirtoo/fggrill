require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Get Bomet Town branch
    const branchRes = await client.query("SELECT id, name FROM branches WHERE name ILIKE '%bomet%' LIMIT 1");
    if (branchRes.rows.length === 0) {
      console.log('Bomet branch not found');
      return;
    }
    const branchId = branchRes.rows[0].id;
    console.log('Branch:', branchRes.rows[0]);

    // Get Food Controls
    // Let's first check if the table exists and what columns it has
    const fcCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'food_controls'");
    console.log('Food controls columns:', fcCols.rows.map(r => r.column_name).join(', '));

    const fcRes = await client.query("SELECT id, name, unit, category FROM food_controls WHERE branch_id = $1 LIMIT 50", [branchId]);
    console.log(`Found ${fcRes.rows.length} food controls`);

    // Get POS Outlet Items for restaurants
    // First get restaurant outlets for this branch
    const outletsRes = await client.query("SELECT id, name FROM pos_outlets WHERE branch_id = $1 AND outlet_type = 'restaurant'", [branchId]);
    const outletIds = outletsRes.rows.map(r => r.id);
    console.log('Restaurant outlets:', outletsRes.rows);

    let posItemsRes;
    if (outletIds.length > 0) {
        const idsStr = outletIds.map(id => `'${id}'`).join(',');
        posItemsRes = await client.query(`SELECT id, product_name, category, price FROM pos_outlet_items WHERE pos_outlet_id IN (${idsStr}) AND is_active = 1`);
    } else {
        // Fallback: check all items for the branch
        const menuRes = await client.query("SELECT id, name, category FROM restaurant_menu_items WHERE branch_id = $1", [branchId]);
        posItemsRes = { rows: menuRes.rows.map(r => ({ id: r.id, product_name: r.name, category: r.category })) };
    }
    
    console.log(`Found ${posItemsRes.rows.length} POS items`);

    // Basic fuzzy matching or suggestion logic (just dump to JSON so we can analyze)
    const fs = require('fs');
    fs.writeFileSync('food_controls_analysis.json', JSON.stringify({
        food_controls: fcRes.rows,
        pos_items: posItemsRes.rows
    }, null, 2));
    console.log('Dumped to food_controls_analysis.json');

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
