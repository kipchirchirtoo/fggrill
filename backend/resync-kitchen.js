require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function syncOne(shiftRow) {
  const shiftLocation = `kitchen_${String(shiftRow.shift || '').toLowerCase()}`;
  const { data: existing } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('branch_id', shiftRow.branch_id)
    .eq('count_date', shiftRow.stocktake_date)
    .eq('location', shiftLocation)
    .eq('store_type', 'kitchen')
    .maybeSingle();

  let stockCountId;
  const now = new Date().toISOString();
  const headerData = {
    branch_id: shiftRow.branch_id,
    count_date: shiftRow.stocktake_date,
    count_type: 'daily',
    store_type: 'kitchen',
    location: shiftLocation,
    status: shiftRow.status,
  };

  if (existing?.id) {
    stockCountId = existing.id;
    const { error } = await supabase.from('stock_counts').update({ ...headerData, updated_at: now }).eq('id', stockCountId);
    if (error) throw error;
  } else {
    const { data: created, error } = await supabase.from('stock_counts').insert({ ...headerData, created_at: now, updated_at: now }).select('id').single();
    if (error) throw error;
    stockCountId = created.id;
  }

  await supabase.from('stock_count_items').delete().eq('stock_count_id', stockCountId);

  const { data: items, error: itemsErr } = await supabase
    .from('kitchen_stocktake_items')
    .select('*')
    .eq('shift_id', shiftRow.id);
  if (itemsErr) throw itemsErr;

  const rows = (items || []).map((it) => {
    const systemQty = num(it.opening_qty) + num(it.added_qty);
    const physicalQty = num(it.closing_qty);
    return {
      stock_count_id: stockCountId,
      item_id: it.inventory_item_id || null,
      item_sku: it.item_name,
      system_quantity: systemQty,
      physical_quantity: physicalQty,
      counted_quantity: physicalQty,
      variance: physicalQty - systemQty,
      status: shiftRow.status,
      created_at: now,
      updated_at: now,
    };
  });

  if (rows.length) {
    const { error } = await supabase.from('stock_count_items').insert(rows);
    if (error) throw error;
  }
  return { location: shiftLocation, itemCount: rows.length };
}

(async () => {
  const { data: shifts, error } = await supabase
    .from('kitchen_stocktake_shifts')
    .select('id, branch_id, stocktake_date, shift, status')
    .not('status', 'eq', 'draft');
  if (error) { console.error(error.message); return; }

  for (const s of shifts) {
    const result = await syncOne(s);
    console.log(`Resynced shift ${s.id} (${s.stocktake_date} shift ${s.shift}) -> stock_counts location='${result.location}', ${result.itemCount} items`);
  }
})();
