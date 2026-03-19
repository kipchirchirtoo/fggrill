const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../python-services/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNodeAPI() {
    try {
        console.log("--- Testing Aging ---");
        const { data: aging, error: err1 } = await supabase
            .from('store_supplier_balances')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code)
            `)
            .order('current_balance', { ascending: false });
        if (err1) console.error("Aging Error:", err1.message || err1);
        else console.log("Aging OK:", aging.length);

        console.log("--- Testing GRNI ---");
        const { data: grni, error: err2 } = await supabase
            .from('store_grni_control_account')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code),
                grn:store_grn(id, grn_number, grn_date)
            `)
            .order('created_at', { ascending: false });
        if (err2) console.error("GRNI Error:", err2.message || err2);
        else console.log("GRNI OK:", grni.length);
        
        console.log("--- Testing VAT ---");
        const { data: vat, error: err3 } = await supabase
            .from('store_supplier_invoices')
            .select(`
                invoice_number,
                invoice_date,
                supplier:store_suppliers(id, name, tax_id, vat_number),
                subtotal,
                vat_amount,
                withholding_vat_amount,
                total_amount,
                status
            `);
        if (err3) console.error("VAT Error:", err3.message || err3);
        else console.log("VAT OK:", vat.length);
    } catch (e) {
        console.error(e);
    }
}
testNodeAPI();
