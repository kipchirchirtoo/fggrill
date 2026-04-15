
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkReportData() {
    console.log('--- Checking Auditor Report Data Sources ---');

    // Check Sales
    const { count: restOrders } = await supabase.from('restaurant_orders').select('*', { count: 'exact', head: true });
    console.log(`Restaurant Orders Count: ${restOrders}`);

    const { count: barOrders } = await supabase.from('bar_orders').select('*', { count: 'exact', head: true });
    console.log(`Bar Orders Count: ${barOrders}`);

    // Check Expenses
    const { count: expenses } = await supabase.from('expenses').select('*', { count: 'exact', head: true });
    console.log(`Expenses Count: ${expenses}`);

    console.log('\n--- Checking Central Store Report Data Sources ---');

    // Check Supplier Balances
    const { count: balances } = await supabase.from('store_supplier_balances').select('*', { count: 'exact', head: true });
    console.log(`Supplier Balances Count: ${balances}`);

    // Check Invoices
    const { count: invoices } = await supabase.from('store_supplier_invoices').select('*', { count: 'exact', head: true });
    console.log(`Supplier Invoices Count: ${invoices}`);

    // Check GRNI
    const { count: grni } = await supabase.from('store_grni_control_account').select('*', { count: 'exact', head: true });
    console.log(`GRNI Entries Count: ${grni}`);
}

checkReportData();
