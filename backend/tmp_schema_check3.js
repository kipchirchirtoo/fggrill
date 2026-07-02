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
    for (const t of ['pos_outlet_items', 'pos_shift_orders', 'pos_outlet_shifts', 'branch_stock', 'restaurant_menu_items', 'restaurant_menu_categories']) {
      console.log('===', t, '===');
      const props = defs[t]?.properties || {};
      console.log(Object.keys(props).filter(k => k.includes('branch') || k === 'outlet_id' || k === 'shift_id' || k === 'id'));
    }
  });
}).on('error', e => console.error('ERR', e.message));
