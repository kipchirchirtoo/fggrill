require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function report() {
    console.log('--- VAT Input Report ---');
    const { data: vatData } = await supabase
        .from('store_supplier_invoices')
        .select('invoice_number, supplier_id, invoice_date, subtotal, vat_amount, total_amount')
        .eq('status', 'approved');

    console.table(vatData);

    console.log('\n--- Supplier Balances (Aging) ---');
    const { data: balances } = await supabase
        .from('store_supplier_balances')
        .select('supplier_id, current_balance, total_invoices, last_invoice_date');

    console.table(balances);

    console.log('\n--- Procurement Audit Trail (Last 10) ---');
    const { data: audit, error: auditErr } = await supabase
        .from('store_procurement_audit_logs')
        .select('action, entity_type, entity_id, entity_reference, description, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (auditErr) console.error('Audit Err:', auditErr);
    else console.table(audit);
}

report();
