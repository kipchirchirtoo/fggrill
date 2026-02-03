require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNILEVER_ID = '47151fed-8aea-426f-a47b-cecbc35c2fb1';
const WHEAT_FLOUR_ID = '6d4c0673-c14e-48a5-9b8b-8a5fb91bdfa3';
const UNILEVER_PIN = 'P051000044U';

async function run() {
    const { data: user } = await supabase.from('users').select('id').limit(1).single();
    const userId = user.id;

    console.log('--- Phase 1: Purchase Order ---');
    const { data: poNum } = await supabase.rpc('generate_po_number');
    const poNumber = poNum || `PO${Date.now()}`;

    const { data: po, error: poErr } = await supabase
        .from('store_purchase_orders')
        .insert({
            po_number: poNumber,
            supplier_id: UNILEVER_ID,
            po_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            status: 'draft',
            subtotal: 21551.72,
            tax_amount: 3448.28,
            total_amount: 25000,
            created_by_id: userId
        })
        .select()
        .single();

    if (poErr) { console.error('PO Error:', poErr); return; }
    console.log(`PO Created: ${po.po_number}`);

    await supabase.from('store_po_items').insert({
        po_id: po.id,
        item_id: WHEAT_FLOUR_ID,
        quantity_ordered: 500,
        quantity_pending: 500,
        unit_price: 50,
        total_price: 25000
    });

    await supabase.from('store_purchase_orders').update({
        status: 'approved',
        approved_by_id: userId,
        approved_at: new Date().toISOString()
    }).eq('id', po.id);
    console.log('PO Approved.');

    console.log('\n--- Phase 2: Goods Received (GRN) ---');
    const { data: grnNum } = await supabase.rpc('generate_grn_number');
    const grnNumber = grnNum || `GRN${Date.now()}`;

    const { data: grn, error: grnErr } = await supabase
        .from('store_grn')
        .insert({
            grn_number: grnNumber,
            supplier_id: UNILEVER_ID,
            po_id: po.id,
            grn_date: new Date().toISOString().split('T')[0],
            received_by_id: userId,
            status: 'draft',
            total_value: 25000,
            total_quantity: 500,
            total_items: 1
        })
        .select()
        .single();

    if (grnErr) { console.error('GRN Error:', grnErr); return; }
    console.log(`GRN Drafted: ${grn.grn_number}`);

    await supabase.from('store_grn_items').insert({
        grn_id: grn.id,
        item_id: WHEAT_FLOUR_ID,
        quantity_received: 500,
        quantity_accepted: 500,
        unit_price: 50,
        total_value: 25000
    });

    console.log('Approving GRN via RPC...');
    const { error: rpcErr } = await supabase.rpc('approve_grn_and_update_all', {
        p_grn_id: grn.id,
        p_approved_by: userId
    });

    if (rpcErr) { console.error('RPC Error:', rpcErr); return; }
    console.log('GRN Approved and Stock Updated.');

    console.log('\n--- Phase 3: Supplier Invoice ---');
    const sinvNum = `SINV-${Date.now()}`;
    const { data: invoice, error: invErr } = await supabase
        .from('store_supplier_invoices')
        .insert({
            invoice_number: sinvNum,
            supplier_id: UNILEVER_ID,
            supplier_pin: UNILEVER_PIN,
            grn_id: grn.id,
            po_id: po.id,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
            subtotal: 21551.72,
            vat_amount: 3448.28,
            total_amount: 25000,
            balance_due: 25000,
            status: 'draft',
            created_by_id: userId
        })
        .select()
        .single();

    if (invErr) { console.error('Invoice Error:', invErr); return; }
    console.log(`Invoice Drafted: ${invoice.invoice_number}`);

    await supabase.from('store_supplier_invoice_items').insert({
        invoice_id: invoice.id,
        item_id: WHEAT_FLOUR_ID,
        grn_id: grn.id,
        quantity: 500,
        unit_price: 50, // This is unit price EXCL VAT if we follow subtotal=qty*unit_price
        subtotal: 25000,
        total_amount: 25000
    });

    console.log('Approving Invoice via RPC...');
    const { error: invRpcErr } = await supabase.rpc('approve_supplier_invoice_and_update_ledger', {
        p_invoice_id: invoice.id,
        p_approved_by: userId
    });

    if (invRpcErr) console.error('Invoice RPC Error:', invRpcErr);
    else console.log('Invoice Approved, Ledger Updated.');

    console.log('\n--- Phase 4: Verification ---');
    const { data: finalItem } = await supabase.from('store_items').select('current_stock').eq('id', WHEAT_FLOUR_ID).single();
    console.log(`Final Stock for Wheat Flour: ${finalItem.current_stock}`);

    const { data: ledger } = await supabase.from('store_supplier_ledger').select('type, amount, running_balance').eq('supplier_id', UNILEVER_ID).order('created_at', { ascending: false }).limit(1).single();
    if (ledger) console.log(`Ledger: ${ledger.type} ${ledger.amount}, Final Balance: ${ledger.running_balance}`);

    const { data: audit } = await supabase.from('store_procurement_audit_logs').select('action').order('created_at', { ascending: false }).limit(3);
    console.log(`Recent Audit Logs: ${audit.map(a => a.action).join(', ')}`);
}

run();
