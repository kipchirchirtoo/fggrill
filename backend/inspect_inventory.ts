import db from './src/db';

async function main() {
  console.log("=== CHECKING TABLES ===");
  const tables = ['simple_items', 'inventory_items', 'inventory_item_catalog'];
  for (const table of tables) {
    try {
      const exists = await db.query(`SELECT to_regclass('public.${table}')`);
      if (exists.rows[0].to_regclass) {
        console.log(`Table '${table}' exists.`);
        const cols = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        console.log(`Columns for '${table}':`);
        cols.rows.forEach(c => {
          console.log(`  - ${c.column_name}: ${c.data_type}`);
        });
      } else {
        console.log(`Table '${table}' does not exist.`);
      }
    } catch (e: any) {
      console.error(`Error with ${table}:`, e.message);
    }
  }
  process.exit(0);
}

main();
