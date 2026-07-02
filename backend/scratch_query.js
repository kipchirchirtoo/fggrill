const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to DB!");

  // Find outlet info
  const outletRes = await client.query(`
    SELECT id, name, branch_id, outlet_type, inventory_location_id
    FROM public.pos_outlets
    WHERE branch_id = 2 AND (outlet_type = 'main_bar' OR name ILIKE '%main bar%');
  `);
  console.log("Outlets for Branch 2:");
  console.log(JSON.stringify(outletRes.rows, null, 2));

  if (outletRes.rows.length === 0) {
    console.log("No outlet found.");
    await client.end();
    return;
  }

  const outletId = outletRes.rows[0].id;
  const locationId = outletRes.rows[0].inventory_location_id;

  const itemsToCheck = [
    'Manyatta',
    'Pineapple Punch',
    'Guarana',
    'Balozi',
    'Guiness',
    'Guinness',
    'Tusker Lager',
    'White cap',
    'Alvaro'
  ];

  console.log("\n--- SEARCHING TABLES ---");
  for (const name of itemsToCheck) {
    console.log(`\n================== SEARCH FOR: "${name}" ==================`);
    
    // 1. pos_outlet_items
    const posRes = await client.query(`
      SELECT id, name, sku, current_stock, source_table, source_item_id, selling_price, track_stock
      FROM public.pos_outlet_items
      WHERE outlet_id = $1 AND (name ILIKE $2 OR sku ILIKE $2)
    `, [outletId, `%${name}%`]);
    console.log("pos_outlet_items:");
    console.log(posRes.rows);

    // 2. bar_drinks
    const drinksRes = await client.query(`
      SELECT id, name, sku, branch_id, price, selling_price
      FROM public.bar_drinks
      WHERE name ILIKE $1 OR sku ILIKE $1
    `, [`%${name}%`]);
    console.log("bar_drinks:");
    console.log(drinksRes.rows);

    // 3. bar_stock (for the drinks found above, for branch_id = 2)
    if (drinksRes.rows.length > 0) {
      const drinkIds = drinksRes.rows.map(d => d.id);
      const stockRes = await client.query(`
        SELECT id, drink_id, branch_id, current_stock, item_name, item_sku, last_updated
        FROM public.bar_stock
        WHERE branch_id = 2 AND (drink_id = ANY($1) OR item_name ILIKE $2)
      `, [drinkIds, `%${name}%`]);
      console.log("bar_stock:");
      console.log(stockRes.rows);
    } else {
      const stockRes = await client.query(`
        SELECT id, drink_id, branch_id, current_stock, item_name, item_sku, last_updated
        FROM public.bar_stock
        WHERE branch_id = 2 AND item_name ILIKE $1
      `, [`%${name}%`]);
      console.log("bar_stock (no drink match):");
      console.log(stockRes.rows);
    }

    // 4. inventory_items
    const invItemRes = await client.query(`
      SELECT id, item_name, sku, category
      FROM public.inventory_items
      WHERE item_name ILIKE $1 OR sku ILIKE $1
    `, [`%${name}%`]);
    console.log("inventory_items:");
    console.log(invItemRes.rows);

    // 5. inventory_balances (for the inventory items found above, for location_id of this outlet)
    if (invItemRes.rows.length > 0 && locationId) {
      const itemIds = invItemRes.rows.map(i => i.id);
      const balRes = await client.query(`
        SELECT id, item_id, location_id, current_quantity
        FROM public.inventory_balances
        WHERE location_id = $1 AND item_id = ANY($2)
      `, [locationId, itemIds]);
      console.log("inventory_balances:");
      console.log(balRes.rows);
    }
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
