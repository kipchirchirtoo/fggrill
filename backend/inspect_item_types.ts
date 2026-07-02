import db from './src/db';

async function main() {
  console.log("=== CHECKING ITEM TYPES ===");
  try {
    const res = await db.query(
      "SELECT DISTINCT item_type FROM inventory_items"
    );
    console.log("Distinct item_type values:");
    res.rows.forEach(r => console.log(`  - ${r.item_type}`));

    const sample = await db.query(
      "SELECT sku, item_name, item_type, store_type, unit FROM inventory_items WHERE sku LIKE 'FG-%' LIMIT 5"
    );
    console.log("Sample FG items:");
    sample.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

main();
