require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
import db from './src/db';

async function main() {
  const { rows } = await db.query(
    `SELECT id, shift_date, shift_type, status, opened_at, closed_at
     FROM public.kitchen_shifts
     WHERE branch_id = 2 AND shift_date = '2026-06-29'::date
     ORDER BY opened_at`
  );
  console.log('shifts on 2026-06-29:', JSON.stringify(rows, null, 2));

  const { rows: items } = await db.query(
    `SELECT ksi.shift_id, ks.shift_type, ks.status, ksi.item_sku, ksi.item_name,
            ksi.opening_stock, ksi.additions, ksi.total_available, ksi.sold_quantity,
            ksi.spoilage_quantity, ksi.system_closing_stock, ksi.physical_count, ksi.variance
     FROM public.kitchen_shift_items ksi
     JOIN public.kitchen_shifts ks ON ks.id = ksi.shift_id
     WHERE ks.branch_id = 2 AND ks.shift_date = '2026-06-29'::date
     ORDER BY ksi.item_sku`
  );
  console.log('items:', JSON.stringify(items, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
