import db from './src/db';

async function main() {
  console.log("=== INSPECTING DB TABLES & VIEWS ===");
  try {
    // 1. Check if inventory_items is a table or view
    const typeRes = await db.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_name IN ('simple_items', 'inventory_items')
    `);
    console.log("Table types:");
    typeRes.rows.forEach(r => console.log(`  - ${r.table_name}: ${r.table_type}`));

    // 2. If view, print definition
    for (const r of typeRes.rows) {
      if (r.table_type === 'VIEW') {
        const viewDef = await db.query(`
          SELECT view_definition 
          FROM information_schema.views 
          WHERE table_name = $1
        `, [r.table_name]);
        console.log(`View definition for ${r.table_name}:`);
        console.log(viewDef.rows[0]?.view_definition);
      }
    }

    // 3. Triggers on simple_items
    const triggers = await db.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('simple_items', 'inventory_items')
    `);
    console.log("Triggers:");
    triggers.rows.forEach(t => {
      console.log(`  - ${t.trigger_name} on ${t.event_object_table} (${t.event_manipulation}): ${t.action_statement}`);
    });

    // 4. Sample row counts
    const simpleCount = await db.query("SELECT COUNT(*) FROM simple_items");
    console.log(`simple_items row count: ${simpleCount.rows[0].count}`);
    const invCount = await db.query("SELECT COUNT(*) FROM inventory_items");
    console.log(`inventory_items row count: ${invCount.rows[0].count}`);

    // 5. Check if simple_items has some KC pineapple items or if it's empty
    const kc = await db.query("SELECT sku, item_name, store_type, category FROM simple_items WHERE item_name ILIKE '%KC%' LIMIT 5");
    console.log("KC items in simple_items:");
    kc.rows.forEach(r => console.log(JSON.stringify(r)));

  } catch (e: any) {
    console.error("Error inspecting:", e.message);
  }
  process.exit(0);
}

main();
