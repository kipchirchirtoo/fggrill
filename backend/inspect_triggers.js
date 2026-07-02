const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const { db } = require('./src/db');
  
  try {
    const res = await db.query(`
      SELECT 
        event_object_table AS table_name,
        trigger_name,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table IN ('purchase_orders', 'store_purchase_orders')
      ORDER BY event_object_table, trigger_name;
    `);
    console.log("Triggers:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error querying triggers:", err);
  } finally {
    process.exit(0);
  }
}

main();
