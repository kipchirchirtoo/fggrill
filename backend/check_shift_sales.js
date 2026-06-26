require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to DB');
    const shiftRes = await client.query("SELECT id, shift_number, branch_id, cashier_id FROM cashier_shift_logs WHERE shift_number = 'SHF-20260625-0001'");
    if (shiftRes.rows.length === 0) {
      console.log('Shift not found');
      return;
    }
    const shift = shiftRes.rows[0];
    console.log('Shift:', shift);

    // Get pos_shift_orders
    const posShiftsRes = await client.query("SELECT id FROM pos_outlet_shifts WHERE cashier_id = $1 AND branch_id = $2", [shift.cashier_id, shift.branch_id]);
    const posShiftIds = posShiftsRes.rows.map(r => r.id);
    
    if (posShiftIds.length > 0) {
      const idsStr = posShiftIds.map(id => `'${id}'`).join(',');
      const posOrdersRes = await client.query(`SELECT payment_method, payment_status, total_amount, amount_paid FROM pos_shift_orders WHERE shift_id IN (${idsStr}) AND payment_status != 'unpaid'`);
      console.log('POS Orders count:', posOrdersRes.rows.length);
      const mpesaPos = posOrdersRes.rows.filter(r => r.payment_method === 'mpesa').reduce((sum, r) => sum + Number(r.amount_paid), 0);
      const cashPos = posOrdersRes.rows.filter(r => r.payment_method === 'cash').reduce((sum, r) => sum + Number(r.amount_paid), 0);
      console.log('POS Orders M-Pesa:', mpesaPos, 'Cash:', cashPos);
    }

    // Get cashier_shift_transactions (as this is how the app calculates sales)
    const transactionsRes = await client.query("SELECT payment_method, amount FROM cashier_shift_transactions WHERE shift_id = $1", [shift.id]);
    console.log('Transactions count:', transactionsRes.rows.length);
    const mpesaTx = transactionsRes.rows.filter(r => r.payment_method === 'mpesa').reduce((sum, r) => sum + Number(r.amount), 0);
    const cashTx = transactionsRes.rows.filter(r => r.payment_method === 'cash').reduce((sum, r) => sum + Number(r.amount), 0);
    console.log('Transactions M-Pesa:', mpesaTx, 'Cash:', cashTx);

    // Call the RPC calculate_shift_summary
    const rpcRes = await client.query("SELECT * FROM calculate_shift_summary($1)", [shift.id]);
    console.log('RPC calculate_shift_summary:', rpcRes.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
