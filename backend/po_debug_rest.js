const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.SUPABASE_PROJECT_URL || env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

(async () => {
  console.log("=== CHECKING store_po_items columns via REST ===");

  // 1. Check store_po_items columns via a limit-0 query
  const r1 = await fetch(
    `${SUPABASE_URL}/rest/v1/store_po_items?limit=0`,
    { method: 'GET', headers: { ...headers, Accept: 'application/json', Prefer: 'count=none' } }
  );
  console.log("store_po_items status:", r1.status, r1.statusText);

  // 2. Check store_purchase_orders columns
  const r2 = await fetch(
    `${SUPABASE_URL}/rest/v1/store_purchase_orders?limit=0`,
    { method: 'GET', headers: { ...headers, Accept: 'application/json', Prefer: 'count=none' } }
  );
  console.log("store_purchase_orders status:", r2.status, r2.statusText);
  if (!r2.ok) {
    const body = await r2.text();
    console.log("Error body:", body);
  }

  // 3. Try to simulate PO create with minimal data to get real error
  console.log("\n=== SIMULATING PO CREATE TO GET REAL ERROR ===");
  const testPO = {
    po_number: 'TEST-DEBUG-001',
    supplier_id: '00000000-0000-0000-0000-000000000001',
    po_date: new Date().toISOString().split('T')[0],
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    status: 'draft',
    payment_terms: 'credit_30_days',
    module: 'central_store',
  };
  const r3 = await fetch(
    `${SUPABASE_URL}/rest/v1/store_purchase_orders`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(testPO)
    }
  );
  console.log("PO insert status:", r3.status, r3.statusText);
  const r3body = await r3.text();
  console.log("PO insert body:", r3body.substring(0, 500));

  // 4. Check generate_po_number function via RPC
  console.log("\n=== TESTING generate_po_number RPC ===");
  const r4 = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/generate_po_number`,
    { method: 'POST', headers, body: '{}' }
  );
  console.log("generate_po_number status:", r4.status);
  const r4body = await r4.text();
  console.log("generate_po_number result:", r4body);

})().catch(err => { console.error(err); process.exit(1); });
