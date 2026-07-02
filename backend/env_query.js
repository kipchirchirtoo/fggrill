const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_NEW;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const query = `
  SELECT 
    o.created_at, oi.item_name, oi.quantity, 
    u.first_name || ' ' || u.last_name as staff_name,
    o.status
  FROM bar_order_items oi
  JOIN bar_orders o ON oi.order_id = o.id
  LEFT JOIN users u ON o.staff_id = u.id OR o.created_by = u.id
  WHERE (oi.item_name ILIKE '%black%white%' OR oi.item_name ILIKE '%balozi%')
    AND o.created_at >= '2026-06-24 00:00:00'
    AND o.created_at < '2026-06-25 00:00:00'
    AND o.status != 'cancelled'
`;

pool.query(query)
  .then(res => {
    console.log('Query successful! Found ' + res.rows.length + ' rows.');
    
    let totalBalozi = 0;
    let totalBW = 0;

    res.rows.forEach(record => {
      const dateStr = new Date(record.created_at).toLocaleString();
      console.log(`- [${dateStr}] ${record.quantity}x ${record.item_name} (Staff: ${record.staff_name || 'Unknown'})`);
      
      if (record.item_name.toLowerCase().includes('balozi')) {
        totalBalozi += record.quantity;
      } else if (record.item_name.toLowerCase().includes('black') && record.item_name.toLowerCase().includes('white')) {
        totalBW += record.quantity;
      }
    });

    console.log("\n--- SUMMARY ---");
    console.log(`Total BALOZI sold: ${totalBalozi}`);
    console.log(`Total BLACK & WHITE 350ML sold: ${totalBW}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
