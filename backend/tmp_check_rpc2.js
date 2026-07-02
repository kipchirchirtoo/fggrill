require('dotenv').config();
const https = require('https');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const u = new URL(url + '/rest/v1/');
const opts = { hostname: u.hostname, path: u.pathname, headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' }, timeout: 20000 };
const req = https.get(opts, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    console.log(JSON.stringify(json.paths['/rpc/exec_sql'], null, 2));
    const def = json.definitions && Object.keys(json.definitions).find(k => /exec_sql/i.test(k));
    if (def) console.log('definition:', JSON.stringify(json.definitions[def], null, 2));
  });
});
req.on('error', e => console.error('REQ_ERR', e.message));
