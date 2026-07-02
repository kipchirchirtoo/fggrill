require('dotenv').config();
const https = require('https');
function get(pathQuery) {
  return new Promise((resolve, reject) => {
    const url = new URL(process.env.SUPABASE_URL + pathQuery);
    https.get(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY } }, (res) => {
      let data=''; res.on('data', d=>data+=d); res.on('end', ()=>resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function main() {
  const branchId = 2;
  const stocktakeDate = '2026-06-26'; // a future date with no existing records -> forces candidate path
  const dayEnd = new Date(new Date(stocktakeDate + 'T00:00:00.000Z').getTime() + 86400000).toISOString();

  const drinks = await get('/rest/v1/bar_drinks?branch_id=eq.2&is_active=eq.true&select=id,name,inventory_item_id');
  const stockRows = await get('/rest/v1/bar_stock?branch_id=eq.2&select=drink_id,current_stock');
  const stockByDrinkId = new Map(stockRows.map(r => [String(r.drink_id), num(r.current_stock)]));

  // since-last-approval window
  const lastApproved = await get('/rest/v1/bar_stocktake_records?branch_id=eq.2&bar_location=eq.main_bar&status=eq.approved&reviewed_at=lt.' + encodeURIComponent(dayEnd) + '&select=reviewed_at&order=reviewed_at.desc&limit=1');
  const from = (lastApproved[0] && lastApproved[0].reviewed_at) || (stocktakeDate + 'T00:00:00.000Z');
  console.log('Window:', from, '->', dayEnd);

  const drinkIds = drinks.map(d => String(d.id));
  const ledger = await get('/rest/v1/bar_stock_ledger?branch_id=eq.2&drink_id=in.(' + drinkIds.join(',') + ')&created_at=gte.' + encodeURIComponent(from) + '&created_at=lt.' + encodeURIComponent(dayEnd) + '&select=drink_id,transaction_type,quantity&limit=5000');
  const additions = new Map(), sales = new Map();
  for (const row of ledger) {
    const did = String(row.drink_id);
    if (row.transaction_type === 'restock') additions.set(did, (additions.get(did)||0) + num(row.quantity));
    else if (row.transaction_type === 'sale') sales.set(did, (sales.get(did)||0) + num(row.quantity));
  }

  const rows = drinks.map(d => {
    const did = String(d.id);
    const opening = stockByDrinkId.get(did) ?? 0;
    const add = additions.get(did) ?? 0;
    const sale = sales.get(did) ?? 0;
    const system = opening + add - sale;
    return { name: d.name, opening, additions: add, sales: sale, system };
  });

  const suspicious = rows.filter(r => r.additions > 0 || r.sales > 0 || r.system < 0);
  console.log('Total items:', rows.length, 'Items with any addition/sale activity:', suspicious.length);
  console.log(JSON.stringify(suspicious, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
