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
    const paths = Object.keys(json.paths || {});
    const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
    const sqlish = rpcPaths.filter(p => /sql|query|exec/i.test(p));
    console.log('total rpc functions exposed:', rpcPaths.length);
    console.log('sql-exec-looking ones:', sqlish);
  });
}).on('error', e => console.error('ERR', e.message));
