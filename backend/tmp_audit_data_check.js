require('dotenv').config();
const https = require('https');
const url = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function get(path) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(path, SUPABASE_URL);
    https.get(u, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  // Check dispatches with destination_branch (nonexistent column) vs destination_branch_id
  let r = await get('/rest/v1/dispatches?select=id,destination_branch_id,status&limit=3');
  console.log('dispatches sample:', r.status, r.body);

  r = await get('/rest/v1/dispatches?select=id&destination_branch=eq.1&limit=3');
  console.log('dispatches filtered by destination_branch (bad col):', r.status, r.body);

  r = await get('/rest/v1/bar_stock_request_items?select=request_id,drink_id,requested_qty,approved_qty&limit=3');
  console.log('bar_stock_request_items sample:', r.status, r.body);

  r = await get('/rest/v1/bar_stock_requests?select=id,branch_id,bar_branch_id&limit=5');
  console.log('bar_stock_requests sample:', r.status, r.body);

  r = await get('/rest/v1/finance_daily_logs?select=id,status&limit=5');
  console.log('finance_daily_logs sample statuses:', r.status, r.body);

  r = await get('/rest/v1/stock_count_items?select=id,item_id,item_sku&limit=5');
  console.log('stock_count_items sample:', r.status, r.body);
}
main().catch(e => console.error(e));
