import db from './src/db';

async function main() {
  console.log("=== INSPECTING MATCHING ITEMS ===");
  const patterns = ['%pineapple%', '%smooth%', '%ginger%', '%drostdy%', '%cellar cask%', '%robertson%', '%kc%'];
  for (const pattern of patterns) {
    try {
      const res = await db.query(
        "SELECT id, sku, item_name, category, store_type, default_selling_price, is_active FROM inventory_items WHERE item_name ILIKE $1",
        [pattern]
      );
      console.log(`Pattern '${pattern}' matches (${res.rowCount} rows):`);
      res.rows.forEach(r => {
        console.log(`  - ${r.sku}: ${r.item_name} | Cat: ${r.category} | StoreType: ${r.store_type} | Price: ${r.default_selling_price} | Active: ${r.is_active}`);
      });
    } catch (e: any) {
      console.error(`Error querying pattern ${pattern}:`, e.message);
    }
  }
  process.exit(0);
}

main();
