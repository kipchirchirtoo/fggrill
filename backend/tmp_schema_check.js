require('dotenv').config();
const https = require('https');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const u = new URL(url + '/rest/v1/');
const opts = { hostname: u.hostname, path: u.pathname, headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' } };
https.get(opts, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    const defs = json.definitions || {};
    for (const t of ['inventory_items', 'dispatches', 'bar_stock_request_items', 'staff_credit_bills', 'approval_requests']) {
      console.log('===', t, '===');
      console.log(Object.keys(defs[t]?.properties || {}));
    }
  });
}).on('error', e => console.error('ERR', e.message));
