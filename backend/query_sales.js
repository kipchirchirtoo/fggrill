const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();
    
    // We are looking for "BLACK AND WHITE 350 ML" or "BALOZI"
    // Let's first see what their exact names are in the DB and check recent sales
    const query = `
      SELECT 
        o.created_at,
        oi.item_name,
        oi.quantity,
        o.waiter_name,
        o.cashier_name,
        o.order_number,
        o.status,
        o.payment_status
      FROM bar_order_items oi
      JOIN bar_orders o ON oi.order_id = o.id
      WHERE (oi.item_name ILIKE '%black%white%' OR oi.item_name ILIKE '%balozi%')
        AND o.created_at >= '2026-06-24 00:00:00'
        AND o.created_at < '2026-06-25 00:00:00'
        AND o.status != 'cancelled'
      ORDER BY o.created_at DESC;
    `;
    
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} sales in bar_orders for yesterday:\n`);
    result.rows.forEach(r => {
      console.log(`Time: ${r.created_at.toISOString()} | Item: ${r.item_name} | Qty: ${r.quantity} | Waiter: ${r.waiter_name} | Cashier: ${r.cashier_name} | Status: ${r.status}`);
    });

  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await client.end();
  }
}

main();
