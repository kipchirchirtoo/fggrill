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
  // Get exact columns of store_purchase_orders
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/store_purchase_orders?limit=1`,
    { method: 'GET', headers: { ...headers, Accept: 'application/json' } }
  );
  const rows = await r.json();
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("store_purchase_orders columns:", Object.keys(rows[0]).sort().join(', '));
  } else {
    // Try insert with empty to get column list
    console.log("No rows. Checking store_po_items:");
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/store_po_items?limit=1`, { method: 'GET', headers: { ...headers, Accept: 'application/json' } });
    const rows2 = await r2.json();
    if (Array.isArray(rows2) && rows2.length > 0) {
      console.log("store_po_items columns:", Object.keys(rows2[0]).sort().join(', '));
    } else {
      // Use information_schema via RPC
      const schemaR = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, { method: 'POST', headers, body: JSON.stringify({ sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'store_purchase_orders' ORDER BY ordinal_position" }) });
      console.log("Schema RPC:", schemaR.status, await schemaR.text());
    }
    console.log("store_po_items raw:", JSON.stringify(rows2).substring(0, 200));
  }
  console.log("store_purchase_orders raw:", JSON.stringify(rows).substring(0, 200));
})().catch(err => { console.error(err); process.exit(1); });
