import db from './src/db';

async function main() {
  console.log("=== LISTING ALL WINES ===");
  try {
    const res = await db.query(
      "SELECT sku, item_name, category, store_type, default_selling_price, is_active FROM inventory_items WHERE category = 'WINES' ORDER BY sku"
    );
    res.rows.forEach(r => {
      console.log(`  - ${r.sku}: ${r.item_name} | Cat: ${r.category} | StoreType: ${r.store_type} | Price: ${r.default_selling_price} | Active: ${r.is_active}`);
    });
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

main();
