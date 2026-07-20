const { Client } = require('pg');

const runTest = async () => {
  const connectionString = "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@db.rvoaowhxyweswwuxbrzm.supabase.co:5432/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();

  const start_date = '2026-07-12';
  const end_date = '2026-07-18';
  const branch_id = '5'; // Mogogoshiek

  console.log('Testing date range:', start_date, 'to', end_date);
  
  const startIso = new Date(start_date + 'T00:00:00.000Z').toISOString();
  const endIso = new Date(end_date + 'T23:59:59.999Z').toISOString();

  console.log('startIso:', startIso);
  console.log('endIso:', endIso);

  const queryText = `
    SELECT COUNT(*) 
    FROM public.pos_shift_orders 
    WHERE created_at >= $1 AND created_at <= $2 
      AND (status IN ('paid', 'credit_bill') OR payment_status IN ('paid', 'credit_bill'))
      AND branch_id = $3
  `;
  
  const countRes = await client.query(queryText, [startIso, endIso, Number(branch_id)]);
  console.log('Total orders in range:', countRes.rows[0].count);

  const rawOrders = await client.query(
    `SELECT id, created_at, order_number, total_amount, items FROM public.pos_shift_orders 
     WHERE created_at >= $1 AND created_at <= $2 
       AND (status IN ('paid', 'credit_bill') OR payment_status IN ('paid', 'credit_bill'))
       AND branch_id = $3`,
    [startIso, endIso, Number(branch_id)]
  );
  console.log('Fetched rows length:', rawOrders.rows.length);

  const soldItemsMap = {};
  rawOrders.rows.forEach(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach(item => {
      if (
        item.is_voided === true ||
        item.is_cancelled === true ||
        item.kitchen_status === 'voided' ||
        item.kitchen_status === 'cancelled' ||
        item.is_fully_voided === true
      ) {
        return;
      }
      const key = item.name || item.item_name;
      if (!soldItemsMap[key]) {
        soldItemsMap[key] = { name: key, quantity: 0, revenue: 0 };
      }
      soldItemsMap[key].quantity += Number(item.quantity ?? item.qty ?? 0) || 0;
      soldItemsMap[key].revenue += Number(item.line_total ?? item.total_price ?? item.total ?? 0) || 0;
    });
  });

  const analysis = Object.values(soldItemsMap).sort((a, b) => b.quantity - a.quantity);
  console.log('Total items in analysis:', analysis.length);
  console.log('First 40 items in analysis:', analysis.slice(0, 40));

  await client.end();
  process.exit(0);
};

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
