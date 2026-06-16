-- Clean DB ETL: procurement, GRN, supplier finance.

BEGIN;

INSERT INTO public.suppliers (id, branch_id, supplier_code, name, contact_person, phone, email, tax_pin, address, status, metadata, created_at, updated_at)
SELECT
  ss.id::uuid,
  NULLIF(ss.branch_id::text, '')::integer,
  COALESCE(NULLIF(ss.supplier_code::text, ''), NULLIF(ss.code::text, ''), 'SUP-' || left(ss.id::text, 8)),
  COALESCE(NULLIF(ss.name::text, ''), NULLIF(ss.supplier_name::text, ''), 'Unknown Supplier'),
  NULLIF(ss.contact_person::text, ''),
  NULLIF(ss.phone::text, ''),
  NULLIF(ss.email::text, ''),
  NULLIF(ss.tax_pin::text, ''),
  NULLIF(ss.address::text, ''),
  CASE WHEN COALESCE(ss.status::text, 'active') IN ('active', 'inactive', 'blocked') THEN ss.status::text ELSE 'active' END,
  to_jsonb(ss),
  COALESCE(ss.created_at::timestamptz, NOW()),
  COALESCE(ss.updated_at::timestamptz, NOW())
FROM legacy_import.store_suppliers ss
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

INSERT INTO public.purchase_orders (id, branch_id, po_number, supplier_id, source_module, status, finance_status, order_date, expected_delivery_date, subtotal, tax_amount, discount_amount, total_amount, created_at, updated_at, metadata)
SELECT
  spo.id::uuid,
  NULLIF(spo.branch_id::text, '')::integer,
  spo.po_number::text,
  spo.supplier_id::uuid,
  COALESCE(NULLIF(spo.source_module::text, ''), 'branch_store'),
  CASE WHEN spo.status::text IN ('draft', 'pending_approval', 'approved', 'sent_to_supplier', 'partially_received', 'fully_received', 'cancelled', 'closed') THEN spo.status::text ELSE 'draft' END,
  CASE
    WHEN spo.status::text IN ('fully_received', 'partially_received') THEN 'pending_bill'
    ELSE 'not_billed'
  END,
  COALESCE(spo.po_date::date, spo.order_date::date, CURRENT_DATE),
  COALESCE(spo.expected_delivery_date::date, spo.delivery_date::date),
  COALESCE(NULLIF(spo.subtotal::text, '')::numeric, 0),
  COALESCE(NULLIF(spo.tax_amount::text, '')::numeric, 0),
  COALESCE(NULLIF(spo.discount_amount::text, '')::numeric, 0),
  COALESCE(NULLIF(spo.total_amount::text, '')::numeric, 0),
  COALESCE(spo.created_at::timestamptz, NOW()),
  COALESCE(spo.updated_at::timestamptz, NOW()),
  to_jsonb(spo)
FROM legacy_import.store_purchase_orders spo
WHERE spo.id IS NOT NULL AND spo.po_number IS NOT NULL AND spo.supplier_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  finance_status = EXCLUDED.finance_status,
  updated_at = NOW();

INSERT INTO public.purchase_order_lines (id, purchase_order_id, item_id, item_name, sku, quantity_ordered, quantity_received, quantity_pending, unit, unit_price, line_total, created_at, updated_at)
SELECT
  spi.id::uuid,
  spi.po_id::uuid,
  ii.id,
  COALESCE(NULLIF(spi.item_name::text, ''), ii.item_name),
  ii.sku,
  COALESCE(NULLIF(spi.quantity_ordered::text, '')::numeric, 0),
  COALESCE(NULLIF(spi.quantity_received::text, '')::numeric, 0),
  COALESCE(NULLIF(spi.quantity_pending::text, '')::numeric, 0),
  COALESCE(NULLIF(spi.unit_of_measure::text, ''), ii.unit),
  COALESCE(NULLIF(spi.unit_price::text, '')::numeric, 0),
  COALESCE(NULLIF(spi.total_price::text, '')::numeric, NULLIF(spi.line_total::text, '')::numeric, 0),
  COALESCE(spi.created_at::timestamptz, NOW()),
  COALESCE(spi.updated_at::timestamptz, NOW())
FROM legacy_import.store_po_items spi
JOIN public.inventory_items ii ON ii.sku = spi.item_id::text OR ii.sku = spi.item_sku::text
WHERE spi.id IS NOT NULL AND spi.po_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  quantity_received = EXCLUDED.quantity_received,
  quantity_pending = EXCLUDED.quantity_pending,
  updated_at = NOW();

INSERT INTO public.goods_receipts (id, branch_id, grn_number, purchase_order_id, supplier_id, delivery_note_number, invoice_number, status, received_at, total_quantity, total_value, notes, metadata, created_at, updated_at)
SELECT
  sg.id::uuid,
  po.branch_id,
  sg.grn_number::text,
  sg.po_id::uuid,
  sg.supplier_id::uuid,
  NULLIF(sg.delivery_note_number::text, ''),
  NULLIF(sg.invoice_number::text, ''),
  CASE
    WHEN sg.status::text IN ('draft', 'rejected') THEN sg.status::text
    WHEN sg.status::text IN ('completed', 'approved', 'posted') THEN 'posted'
    WHEN sg.status::text = 'partially_accepted' THEN 'partially_accepted'
    ELSE 'posted'
  END,
  COALESCE(sg.received_at::timestamptz, sg.created_at::timestamptz, NOW()),
  COALESCE(NULLIF(sg.total_quantity::text, '')::numeric, 0),
  COALESCE(NULLIF(sg.total_amount::text, '')::numeric, NULLIF(sg.total_value::text, '')::numeric, 0),
  NULLIF(sg.notes::text, ''),
  to_jsonb(sg),
  COALESCE(sg.created_at::timestamptz, NOW()),
  COALESCE(sg.updated_at::timestamptz, NOW())
FROM legacy_import.store_grn sg
JOIN public.purchase_orders po ON po.id = sg.po_id::uuid
WHERE sg.id IS NOT NULL AND sg.grn_number IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.goods_receipt_lines (id, goods_receipt_id, purchase_order_line_id, item_id, item_name, sku, quantity_ordered, quantity_received, quantity_accepted, quantity_rejected, unit, unit_price, line_total, quality_status, created_at)
SELECT
  sgi.id::uuid,
  sgi.grn_id::uuid,
  NULLIF(sgi.po_item_id::text, '')::uuid,
  ii.id,
  COALESCE(NULLIF(sgi.item_name::text, ''), ii.item_name),
  ii.sku,
  COALESCE(NULLIF(sgi.quantity_ordered::text, '')::numeric, 0),
  COALESCE(NULLIF(sgi.quantity_received::text, '')::numeric, 0),
  COALESCE(NULLIF(sgi.quantity_accepted::text, '')::numeric, NULLIF(sgi.quantity_received::text, '')::numeric, 0),
  COALESCE(NULLIF(sgi.quantity_rejected::text, '')::numeric, 0),
  COALESCE(NULLIF(sgi.unit_of_measure::text, ''), ii.unit),
  COALESCE(NULLIF(sgi.unit_price::text, '')::numeric, 0),
  COALESCE(NULLIF(sgi.line_total::text, '')::numeric, 0),
  CASE WHEN sgi.quality_status::text IN ('accepted', 'damaged', 'expired', 'rejected') THEN sgi.quality_status::text ELSE 'accepted' END,
  COALESCE(sgi.created_at::timestamptz, NOW())
FROM legacy_import.store_grn_items sgi
JOIN public.inventory_items ii ON ii.sku = sgi.item_id::text OR ii.sku = sgi.item_sku::text
WHERE sgi.id IS NOT NULL AND sgi.grn_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

