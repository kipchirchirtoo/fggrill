const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function run() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' 
  });
  
  await client.connect();

  try {
    await client.query('BEGIN');
    
    // Get all bar items from simple_items
    const { rows: barItems } = await client.query(
      `SELECT sku, item_name, description, category, retail_price, cost_price, unit_of_measure, branch_id 
       FROM simple_items 
       WHERE store_type = 'bar_store' AND is_active = true`
    );

    console.log(`Found ${barItems.length} bar items in simple_items`);

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of barItems) {
      // Check if drink already exists
      const existingRes = await client.query(
        "SELECT id FROM bar_drinks WHERE name = $1 AND branch_id = $2",
        [item.item_name, item.branch_id]
      );

      if (existingRes.rows.length > 0) {
        // Update existing
        await client.query(
          `UPDATE bar_drinks 
           SET price = $1, cost_price = $2, unit = $3, description = $4, is_available = true, updated_at = NOW()
           WHERE id = $5`,
          [item.retail_price, item.cost_price, item.unit_of_measure, item.description, existingRes.rows[0].id]
        );
        updatedCount++;
        console.log(`Updated: ${item.item_name} (Branch ${item.branch_id})`);
      } else {
        // Insert new
        const drinkId = uuidv4();
        await client.query(
          `INSERT INTO bar_drinks (id, name, description, price, cost_price, unit, is_available, branch_id, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            drinkId,
            item.item_name,
            item.description,
            item.retail_price,
            item.cost_price,
            item.unit_of_measure,
            true,
            item.branch_id
          ]
        );
        insertedCount++;
        console.log(`Inserted: ${item.item_name} (Branch ${item.branch_id})`);
      }
    }

    await client.query('COMMIT');
    console.log(`\n=== SUMMARY ===`);
    console.log(`Inserted: ${insertedCount} drinks`);
    console.log(`Updated: ${updatedCount} drinks`);
    console.log(`Skipped: ${skippedCount} drinks`);
    console.log(`Total processed: ${barItems.length}`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Sync failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run();
