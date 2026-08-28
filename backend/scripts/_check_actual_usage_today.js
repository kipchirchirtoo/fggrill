require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const ksi = await client.query(`
    SELECT ksi.item_sku, ksi.item_name, ksi.quantity_issued, kps.session_date, kps.shift_type, kps.branch_id
    FROM kitchen_session_issues ksi
    JOIN kitchen_production_sessions kps ON kps.id = ksi.session_id
    WHERE kps.branch_id = 2 AND kps.session_date = '2026-06-28'
  `);
  console.log('kitchen_session_issues today:', ksi.rows);

  const kshifts = await client.query(`SELECT id, shift_date, shift_type, status FROM kitchen_shifts WHERE branch_id=2 AND shift_date='2026-06-28'`);
  console.log('kitchen_shifts today:', kshifts.rows);

  const ksItems = await client.query(`
    SELECT ksh.id as shift_id, item_sku, item_name, sold_quantity, opening_value
    FROM kitchen_shift_items ksh2
    JOIN kitchen_shifts ksh ON ksh.id = ksh2.shift_id
    WHERE ksh.branch_id=2 AND ksh.shift_date='2026-06-28'
    LIMIT 20
  `).catch(e => ({rows: [], err: e.message}));
  console.log('kitchen_shift_items today:', ksItems.rows, ksItems.err);

  const usageRecords = await client.query(`SELECT count(*) FROM kitchen_usage_records WHERE branch_id=2 AND usage_date='2026-06-28'`).catch(e => ({rows:[{count:'N/A'}], err: e.message}));
  console.log('kitchen_usage_records today count:', usageRecords.rows, usageRecords.err);

  const stockHist = await client.query(`
    SELECT item_sku, item_name, quantity, movement_type, created_at
    FROM stock_history
    WHERE branch_id = 2 AND created_at >= '2026-06-28T00:00:00Z' AND created_at < '2026-06-29T00:00:00Z'
    ORDER BY created_at DESC LIMIT 20
  `).catch(e => ({rows: [], err: e.message}));
  console.log('stock_history today:', stockHist.rows, stockHist.err);

  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
