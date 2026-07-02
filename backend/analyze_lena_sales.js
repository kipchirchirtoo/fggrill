const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  // 1. Find user matching 'Lena' or 'Sigei'
  const userRes = await client.query(`
    SELECT id, email, first_name, last_name, role, branch_id 
    FROM users 
    WHERE first_name ILIKE '%Lena%' OR last_name ILIKE '%Lena%' OR first_name ILIKE '%Sigei%' OR last_name ILIKE '%Sigei%'
  `);
  console.log('\n--- User Records ---');
  console.log(userRes.rows);

  if (userRes.rows.length === 0) {
    console.log('No user matching Lena Sigei found.');
    await client.end();
    return;
  }

  const userIds = userRes.rows.map(r => r.id);

  // 2. Find open shifts for these users in cashier_shift_logs
  const cashierShiftsRes = await client.query(`
    SELECT id, cashier_id, shift_start, status, branch_id 
    FROM cashier_shift_logs 
    WHERE cashier_id = ANY($1) AND status = 'open'
    ORDER BY created_at DESC
  `, [userIds]);
  console.log('\n--- Cashier Shift Logs (Open) ---');
  console.log(cashierShiftsRes.rows);

  // 3. Find open POS outlet shifts
  const posShiftsRes = await client.query(`
    SELECT * 
    FROM pos_outlet_shifts 
    WHERE cashier_id = ANY($1) AND status = 'open'
    ORDER BY created_at DESC
  `, [userIds]);
  console.log('\n--- Open POS Outlet Shifts ---');
  console.log(posShiftsRes.rows);

  const posShiftIds = posShiftsRes.rows.map(r => r.id);

  if (posShiftIds.length > 0) {
    // Get the orders in those shifts
    const ordersRes = await client.query(`
      SELECT id, order_number, total_amount, amount_paid, balance_amount, payment_status, status, items, created_at, shift_id
      FROM pos_shift_orders
      WHERE shift_id = ANY($1)
      ORDER BY created_at DESC
    `, [posShiftIds]);
    console.log(`\n--- Orders under POS Shifts (Count: ${ordersRes.rows.length}) ---`);

    // Analyze items sold
    const itemsBreakdown = {};
    let totalSales = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    ordersRes.rows.forEach(order => {
      const isVoidedOrCancelled = order.status === 'voided' || order.status === 'cancelled';
      console.log(`Order: ${order.order_number}, Total: ${order.total_amount}, Paid: ${order.amount_paid}, Status: ${order.status}, Payment Status: ${order.payment_status}`);
      
      if (isVoidedOrCancelled) return;
      
      totalSales += Number(order.total_amount || 0);
      totalPaid += Number(order.amount_paid || 0);
      totalBalance += Number(order.balance_amount || 0);

      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach(item => {
        const name = item.name || 'Unknown Item';
        const qty = Number(item.quantity || 1);
        const voidedQty = Number(item.voided_qty || 0);
        const activeQty = qty - voidedQty;
        const price = Number(item.unit_price || item.price || 0);
        const subtotal = activeQty * price;

        if (activeQty > 0) {
          if (!itemsBreakdown[name]) {
            itemsBreakdown[name] = { qty: 0, total: 0 };
          }
          itemsBreakdown[name].qty += activeQty;
          itemsBreakdown[name].total += subtotal;
        }
      });
    });

    console.log('\n--- Items Sold Breakdown ---');
    console.log(itemsBreakdown);
    console.log('\n--- Totals ---');
    console.log(`Total Sales: KES ${totalSales}`);
    console.log(`Total Paid: KES ${totalPaid}`);
    console.log(`Total Balance/Unpaid: KES ${totalBalance}`);
  } else {
    console.log('No active POS shifts found.');
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
