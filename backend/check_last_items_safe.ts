import db from './src/db';

async function main() {
  console.log("=== CHECKING LATEST ITEMS SAFE ===");
  try {
    const res = await db.query(
      "SELECT sku, item_name, category, store_type, default_selling_price FROM inventory_items WHERE sku ~ '^FG-[0-9]+$' ORDER BY CAST(SUBSTRING(sku FROM 4) AS INTEGER) DESC LIMIT 10"
    );
    res.rows.forEach(r => {
      console.log(`  - ${r.sku}: ${r.item_name} | Cat: ${r.category} | StoreType: ${r.store_type} | Price: ${r.default_selling_price}`);
    });
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

main();
