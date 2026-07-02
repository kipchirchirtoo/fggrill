require('dotenv').config();
const https = require('https');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const u = new URL(url + '/rest/v1/');
const opts = { hostname: u.hostname, path: u.pathname, headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' }, timeout: 20000 };
https.get(opts, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    console.log('=== simple_items ===');
    console.log(Object.keys(json.definitions?.simple_items?.properties || {}));
  });
}).on('error', e => console.error('ERR', e.message));
