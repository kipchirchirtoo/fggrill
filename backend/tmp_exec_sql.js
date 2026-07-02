require('dotenv').config();
const https = require('https');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const u = new URL(url);

function execSql(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ p_sql: sql });
    const opts = {
      hostname: u.hostname,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Prefer: 'return=representation'
      },
      timeout: 25000
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { execSql };

if (require.main === module) {
  const sql = process.argv[2];
  if (!sql) {
    console.error('usage: node tmp_exec_sql.js "<sql>"');
    process.exit(1);
  }
  execSql(sql).then((r) => {
    console.log('STATUS', r.status);
    console.log(r.body);
  }).catch((e) => {
    console.error('ERROR', e.message);
    process.exit(1);
  });
}
