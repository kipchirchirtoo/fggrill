const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();
    const query = `
      SELECT 
        o.created_at, oi.item_name, oi.quantity, o.waiter_name, o.cashier_name, o.status
      FROM bar_order_items oi
      JOIN bar_orders o ON oi.order_id = o.id
      WHERE (oi.item_name ILIKE '%black%white%' OR oi.item_name ILIKE '%balozi%')
        AND o.created_at >= '2026-06-24 00:00:00'
        AND o.created_at < '2026-06-25 00:00:00'
        AND o.status != 'cancelled'
    `;
    const res = await client.query(query);
    
    if (res.rows.length === 0) {
      console.log("No sales found for these items in yesterday's shift.");
      process.exit(0);
    }
    
    let totalBalozi = 0;
    let totalBW = 0;

    res.rows.forEach(record => {
      const dateStr = new Date(record.created_at).toLocaleString();
      console.log(`- [${dateStr}] ${record.quantity}x ${record.item_name} (Waiter: ${record.waiter_name || 'N/A'}, Cashier: ${record.cashier_name || 'N/A'}, Status: ${record.status})`);
      
      if (record.item_name.toLowerCase().includes('balozi')) {
        totalBalozi += record.quantity;
      } else if (record.item_name.toLowerCase().includes('black') && record.item_name.toLowerCase().includes('white')) {
        totalBW += record.quantity;
      }
    });

    console.log("\n--- SUMMARY ---");
    console.log(`Total BALOZI sold: ${totalBalozi}`);
    console.log(`Total BLACK & WHITE 350ML sold: ${totalBW}`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
