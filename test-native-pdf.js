const http = require('http');

// Change supplier_id to a real one from your DB
const body = JSON.stringify({
  reportType: 'supplier_statement',
  format: 'pdf',
  filters: {
    supplier_id: 'test-supplier-id', // replace with real ID
    from_date: '2025-01-01',
    to_date: '2025-12-31'
  }
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/reports/export',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}`);
  
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const ct = res.headers['content-type'] || '';
    if (ct.includes('application/pdf')) {
      console.log(`✅ Got PDF! Size: ${Buffer.concat(chunks).length} bytes`);
    } else {
      console.log('Response body:', Buffer.concat(chunks).toString());
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(body);
req.end();
