const fs = require('fs');
const envText = fs.readFileSync(process.argv[2], 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map(line => {
  const idx = line.indexOf('=');
  return idx === -1 ? [line, ''] : [line.slice(0, idx), line.slice(idx + 1)];
}));
const itemId = process.argv[3];
const base = env.SUPABASE_PROJECT_URL + '/rest/v1/pos_outlet_items';
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};
(async () => {
  const before = await fetch(`${base}?select=id,name,is_active&id=eq.${itemId}`, { headers });
  const beforeJson = await before.json();
  const patch = await fetch(`${base}?id=eq.${itemId}`, { method: 'PATCH', headers, body: JSON.stringify({ is_active: false }) });
  const patchJson = await patch.json();
  const after = await fetch(`${base}?select=id,name,is_active&id=eq.${itemId}`, { headers });
  const afterJson = await after.json();
  console.log(JSON.stringify({ before: beforeJson, patched: patchJson, after: afterJson }, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
