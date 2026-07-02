const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => { const idx = line.indexOf('='); return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]; })
);
const SUPABASE_URL = env.SUPABASE_PROJECT_URL || env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

(async () => {
  // Check triggers on store_po_items via RPC
  // Use a full simulated PO create to get the real error flow:
  
  // 1. Create a real PO header first
  const pn = await fetch(`${SUPABASE_URL}/rest/v1/rpc/generate_po_number`, { method: 'POST', headers, body: '{}' });
  const poNum = await pn.json();
  console.log("PO number:", poNum);

  // 2. Look up a valid supplier
  const suppR = await fetch(`${SUPABASE_URL}/rest/v1/store_suppliers?limit=1&select=id,name`, { method: 'GET', headers: { ...headers, Accept: 'application/json' } });
  const supps = await suppR.json();
  console.log("First supplier:", JSON.stringify(supps[0]));

  if (!supps[0]) { console.log("No suppliers found"); process.exit(1); }

  // 3. Insert the PO header
  const poR = await fetch(`${SUPABASE_URL}/rest/v1/store_purchase_orders`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      po_number: poNum,
      supplier_id: supps[0].id,
      po_date: new Date().toISOString().split('T')[0],
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      status: 'draft',
      payment_terms: 'credit_30_days',
      source_module: 'central_store',
    })
  });
  const poData = await poR.json();
  console.log("\nPO header insert:", poR.status, JSON.stringify(poData).substring(0, 200));
  
  if (!poR.ok || !poData[0]?.id) {
    console.log("PO header insert failed - stopping");
    process.exit(1);
  }

  const poId = poData[0].id;
  console.log("PO ID:", poId);

  // 4. Insert a PO item - this should trigger the bug
  const itemR = await fetch(`${SUPABASE_URL}/rest/v1/store_po_items`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      purchase_order_id: poId,
      item_id: '3ad2403a-ee39-46ff-aff4-3c3f782396f5', // KC GINGER 250ML UUID from the log
      sku: 'FG-434',
      item_name: 'KC GINGER 250ML',
      unit: 'bottle',
      quantity_ordered: 1,
      quantity_pending: 1,
      unit_price: 0,
      line_total: 0,
    })
  });
  console.log("\nPO item insert:", itemR.status, itemR.statusText);
  const itemBody = await itemR.text();
  console.log("PO item response:", itemBody.substring(0, 600));

  // 5. Cleanup: delete the test PO header
  await fetch(`${SUPABASE_URL}/rest/v1/store_purchase_orders?id=eq.${poId}`, { method: 'DELETE', headers });
  console.log("\nCleaned up test PO");

})().catch(err => { console.error(err); process.exit(1); });
