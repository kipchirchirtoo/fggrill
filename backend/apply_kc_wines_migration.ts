import db from './src/db';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const sqlFile = path.resolve(__dirname, '../database/migrations/20260625_add_kc_variants_and_wines.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log("=== APPLYING MIGRATION: 20260625_add_kc_variants_and_wines.sql ===");
  try {
    await db.query(sql);
    console.log("Migration applied successfully.");

    // Verify new items
    const res = await db.query(`
      SELECT sku, item_name, category, store_type, default_selling_price
      FROM inventory_items
      WHERE sku IN (
        'FG-428','FG-429','FG-430',
        'FG-431','FG-432','FG-433',
        'FG-434','FG-435','FG-436',
        'FG-437','FG-438','FG-439',
        'FG-440','FG-441','FG-442'
      )
      ORDER BY CAST(SUBSTRING(sku FROM 4) AS INTEGER)
    `);
    console.log(`Inserted ${res.rowCount} rows:`);
    res.rows.forEach(r => {
      console.log(`  ✅ ${r.sku}: ${r.item_name} | ${r.category} | ${r.store_type} | KES ${r.default_selling_price}`);
    });
  } catch (e: any) {
    console.error("Error applying migration:", e.message);
    if (e.detail) console.error("Detail:", e.detail);
    if (e.hint) console.error("Hint:", e.hint);
  }
  process.exit(0);
}

main();
