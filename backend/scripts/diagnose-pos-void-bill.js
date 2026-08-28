#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const code = process.argv[2] || 'POS-1782652912303';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  await client.connect();

  const orders = await client.query(
    `
      SELECT id, order_number, short_code, total_amount, balance_amount,
             amount_paid, payment_status, status, items,
             jsonb_array_length(COALESCE(items, '[]'::jsonb)) AS item_count,
             created_at, updated_at
      FROM pos_shift_orders
      WHERE order_number = $1 OR short_code = $1
      ORDER BY created_at DESC
      LIMIT 5
    `,
    [code],
  );

  console.log('orders');
  console.log(JSON.stringify(orders.rows.map((row) => ({
    id: row.id,
    order_number: row.order_number,
    short_code: row.short_code,
    total_amount: row.total_amount,
    balance_amount: row.balance_amount,
    amount_paid: row.amount_paid,
    payment_status: row.payment_status,
    status: row.status,
    item_count: row.item_count,
    updated_at: row.updated_at,
    items: (row.items || []).map((item, index) => ({
      index,
      name: item.name || item.item_name,
      quantity: item.quantity,
      qty: item.qty,
      unit_price: item.unit_price,
      price: item.price,
      line_total: item.line_total,
      total_price: item.total_price,
      voided_qty: item.voided_qty,
      active_qty: item.active_qty,
      active_total: item.active_total,
      is_fully_voided: item.is_fully_voided,
      void_pending_approval: item.void_pending_approval,
      kitchen_status: item.kitchen_status,
    })),
  })), null, 2));

  const orderIds = orders.rows.map((row) => row.id);
  if (orderIds.length) {
    const voidRequests = await client.query(
      `
        SELECT id, order_id, item_index, item_name, unit_price, qty_to_void,
               status, reason_category, created_at, updated_at
        FROM pos_item_void_requests
        WHERE order_id = ANY($1::uuid[])
        ORDER BY created_at DESC
      `,
      [orderIds],
    );
    console.log('void_requests');
    console.log(JSON.stringify(voidRequests.rows, null, 2));

    const voidLog = await client.query(
      `
        SELECT order_id, item_index, item_name, unit_price, qty_before_void,
               qty_voided, qty_after_void, amount_voided, voided_at
        FROM pos_item_void_log
        WHERE order_id = ANY($1::uuid[])
        ORDER BY voided_at DESC
      `,
      [orderIds],
    );
    console.log('void_log');
    console.log(JSON.stringify(voidLog.rows, null, 2));
  }

  const fn = await client.query(
    `SELECT pg_get_functiondef('public.cashier_acknowledge_item_void(uuid,uuid)'::regprocedure) AS def`,
  );
  const def = fn.rows[0]?.def || '';
  console.log('function_checks');
  console.log(JSON.stringify({
    requires_kitchen_acknowledged: def.includes("v_request.status <> 'kitchen_acknowledged'"),
    resets_bill_reprint_count: def.includes('bill_reprint_count = 0'),
    quantity_expression: (def.match(/v_quantity :=[^;]+;/) || [''])[0],
    unit_price_expression: (def.match(/v_unit_price :=[^;]+;/) || [''])[0],
    total_expression: (def.match(/v_new_total :=[^;]+;/) || [''])[0],
  }, null, 2));

  const triggers = await client.query(
    `
      SELECT trigger_name, action_timing, event_manipulation,
             action_statement, action_orientation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'pos_shift_orders'
      ORDER BY trigger_name, event_manipulation
    `,
  );
  console.log('pos_shift_orders_triggers');
  console.log(JSON.stringify(triggers.rows, null, 2));
}

main()
  .catch((error) => {
    console.error('diagnostic_failed', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
