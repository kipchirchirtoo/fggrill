require('dotenv').config();
const https = require('https');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const u = new URL(url);

function get(path) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: u.hostname, path, headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' }, timeout: 20000 };
    const req = https.get(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const a = await get('/rest/v1/simple_items?select=id&limit=1');
  console.log('simple_items count-range:', a.headers['content-range']);
  const b = await get('/rest/v1/inventory_items?select=id&limit=1');
  console.log('inventory_items count-range:', b.headers['content-range']);
  const c = await get('/rest/v1/simple_items?select=store_type&limit=1000');
  const types = new Set(JSON.parse(c.body).map(r => r.store_type));
  console.log('distinct simple_items.store_type values (first 1000 rows):', [...types]);
  const d = await get('/rest/v1/simple_items?select=branch_id&limit=1000');
  const branches = new Set(JSON.parse(d.body).map(r => r.branch_id));
  console.log('distinct simple_items.branch_id values (first 1000 rows):', [...branches]);
})().catch(e => console.error('ERR', e.message));
