import db from './db';

// Mock a request query object
const runTest = async () => {
  const start_date = '2026-07-12';
  const end_date = '2026-07-18';
  const branch_id = '5'; // Mogogoshiek

  console.log('Testing date range:', start_date, 'to', end_date);
  
  const d = new Date(start_date + 'T00:00:00.000Z');
  const startIso = d.toISOString();
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
  
  const { rows } = await db.query(queryText, [startIso, endIso, Number(branch_id)]);
  console.log('Total orders in range:', rows[0].count);

  const rawOrders = await db.query(
    `SELECT id, created_at, order_number, total_amount FROM public.pos_shift_orders 
     WHERE created_at >= $1 AND created_at <= $2 
       AND (status IN ('paid', 'credit_bill') OR payment_status IN ('paid', 'credit_bill'))
       AND branch_id = $3`,
    [startIso, endIso, Number(branch_id)]
  );
  console.log('Fetched rows length:', rawOrders.rows.length);

  const datesFound = [...new Set(rawOrders.rows.map(r => r.created_at.toISOString().split('T')[0]))];
  console.log('Dates found in database for these orders:', datesFound);
  
  process.exit(0);
};

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
