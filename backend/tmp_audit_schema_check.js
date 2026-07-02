require('dotenv').config();
const https = require('https');
const url = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function get(path, headers) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(path, SUPABASE_URL);
    https.get(u, { headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  const openapi = await get('/rest/v1/', { 'Accept': 'application/openapi+json', apikey: KEY, Authorization: `Bearer ${KEY}` });
  const spec = JSON.parse(openapi.body);
  const tablesToCheck = ['inventory_items', 'bar_drinks', 'restaurant_bar_inventory', 'stock_counts', 'stock_count_items', 'simple_items', 'unpaid_bills', 'staff_credit_bills', 'finance_daily_logs', 'pos_shift_orders', 'dispatches', 'bar_stock_requests', 'bar_stock_request_items', 'audit_config_consumption'];
  for (const t of tablesToCheck) {
    const def = spec.definitions?.[t];
    if (!def) { console.log(`TABLE ${t}: NOT FOUND`); continue; }
    console.log(`TABLE ${t}: columns = ${Object.keys(def.properties || {}).join(', ')}`);
  }
}
main().catch(e => console.error(e));
