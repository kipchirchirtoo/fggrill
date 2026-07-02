import db from './src/db';

async function main() {
  const res = await db.query(
    "SELECT sku, item_name, category, store_type, default_selling_price, is_active FROM inventory_items WHERE item_name ILIKE '%jw%red%' OR item_name ILIKE '%j w%red%' OR item_name ILIKE '%johnnie%red%' OR sku = 'FG-277'"
  );
  console.log(`Found ${res.rowCount} rows:`);
  res.rows.forEach(r => {
    console.log(`  - ${r.sku}: ${r.item_name} | ${r.category} | ${r.store_type} | KES ${r.default_selling_price} | Active: ${r.is_active}`);
  });
  process.exit(0);
}
main();
