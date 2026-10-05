const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT bs.item_sku, bs.quantity, bs.reorder_level,
           ii.item_name, ii.category, ii.unit_of_measure, ii.is_active
    FROM branch_stock bs
    LEFT JOIN inventory_items ii ON ii.sku = bs.item_sku
    WHERE bs.branch_id = 3
    ORDER BY ii.category, bs.item_sku
  `);
  console.log('Total Kaplong branch_stock rows:', res.rows.length);
  const uncategorised = res.rows.filter(r => !r.category);
  console.log('Uncategorised rows in inventory_items:', uncategorised.length);
  if (uncategorised.length > 0) {
    console.log('Sample uncategorised:', uncategorised.map(u => u.item_sku));
  }
  const categories = {};
  for (const r of res.rows) {
    const cat = r.category || 'Uncategorised';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  console.log('Categories breakdown:', categories);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
