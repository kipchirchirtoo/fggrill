import db from './src/db';

async function main() {
  console.log("=== CHECKING store_purchase_orders & store_po_items ===");
  try {
    // Check table existence
    const tables = ['store_purchase_orders', 'store_po_items'];
    for (const t of tables) {
      const res = await db.query(`SELECT to_regclass('public.${t}')`);
      console.log(`${t}: ${res.rows[0].to_regclass ? 'EXISTS' : 'NOT FOUND'}`);
      if (res.rows[0].to_regclass) {
        const cols = await db.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [t]);
        cols.rows.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
      }
    }

    // Check constraints on store_po_items
    const constraints = await db.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'store_po_items'
    `);
    console.log("\nConstraints on store_po_items:");
    constraints.rows.forEach(c => console.log(`  - ${c.constraint_name}: ${c.constraint_type}`));

    // Try a dry run insert to see what fails
    // First check if generate_po_number function exists
    const fn = await db.query(`SELECT to_regproc('public.generate_po_number')`);
    console.log(`\ngenerate_po_number function: ${fn.rows[0].to_regproc ? 'EXISTS' : 'NOT FOUND'}`);

  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.detail) console.error("Detail:", e.detail);
  }
  process.exit(0);
}
main();
