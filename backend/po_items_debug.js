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
  // Get exact columns of store_po_items
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/store_po_items?limit=1`,
    { method: 'GET', headers: { ...headers, Accept: 'application/json' } }
  );
  const rows = await r.json();
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("store_po_items columns:", Object.keys(rows[0]).sort().join(', '));
    console.log("Sample row:", JSON.stringify(rows[0]));
  } else {
    console.log("No rows in store_po_items");

    // Try inserting a minimal PO items row to expose constraint errors
    // First create a test PO header
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/store_purchase_orders?limit=1&status=eq.draft`,
      { method: 'GET', headers: { ...headers, Accept: 'application/json' } }
    );
    const pos = await r2.json();
    console.log("Draft POs:", JSON.stringify(pos).substring(0, 200));
  }

  // Also check store_po_items via a bad insert to see constraints
  const testItem = {
    purchase_order_id: '00000000-0000-0000-0000-000000000001',
    item_id: '00000000-0000-0000-0000-000000000001',
    sku: 'FG-434',
    item_name: 'TEST',
    unit: 'bottle',
    quantity_ordered: 1,
    quantity_pending: 1,
    unit_price: 0,
    line_total: 0,
  };
  const r3 = await fetch(
    `${SUPABASE_URL}/rest/v1/store_po_items`,
    { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(testItem) }
  );
  console.log("\nTest po_items insert:", r3.status, r3.statusText);
  const body3 = await r3.text();
  console.log("Response:", body3.substring(0, 500));
})().catch(err => { console.error(err); process.exit(1); });
