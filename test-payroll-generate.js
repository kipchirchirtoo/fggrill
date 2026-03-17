const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api${path}`, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch(e) { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== TESTING PAYROLL GENERATE ===\n');

  // Try login with various credentials
  let token = null;
  for (const creds of [
    { email: 'admin@famousgates.com', password: 'admin123' },
    { email: 'superadmin@famousgates.com', password: 'admin123' },
    { email: 'hr@famousgates.com', password: 'admin123' }
  ]) {
    const r = await post('/auth/login', creds).catch(() => null);
    if (r?.data?.token || r?.data?.data?.token) {
      token = r.data.token || r.data.data?.token;
      console.log('Logged in as:', creds.email);
      break;
    }
  }

  if (!token) console.log('WARNING: No token, proceeding without auth\n');

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  console.log(`Generating payroll for ${month}/${year}...`);

  const r = await post('/payroll/generate', { month, year }, token);
  console.log('HTTP Status:', r.status);

  if (r.data?.data?.errors?.length > 0) {
    console.log('\nErrors:', JSON.stringify(r.data.data.errors, null, 2));
  }

  const results = r.data?.data?.results || [];
  console.log(`\nProcessed: ${results.length} staff`);

  if (results[0]) {
    console.log('\nFirst result:');
    const rec = results[0];
    console.log('  staff_id:', rec.staff_id);
    console.log('  basic_salary:', rec.basic_salary);
    console.log('  total_credit_bills:', rec.total_credit_bills);
    console.log('  total_advances:', rec.total_advances);
    console.log('  loan_deduction:', rec.loan_deduction);
    console.log('  uncollected_bills_deduction:', rec.uncollected_bills_deduction);
    console.log('  paye:', rec.paye);
    console.log('  total_deductions:', rec.total_deductions);
    console.log('  net_pay:', rec.net_pay);
  }
}

run().catch(console.error);
