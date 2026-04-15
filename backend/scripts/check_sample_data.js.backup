
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSampleData() {
    console.log('--- Sample Restaurant Orders ---');
    const { data: orders } = await supabase.from('restaurant_orders').select('id, created_at, total_amount, branch_id').limit(5);
    console.log(JSON.stringify(orders, null, 2));

    console.log('\n--- Sample Expenses ---');
    const { data: expenses } = await supabase.from('expenses').select('id, expense_date, amount, branch_id').limit(5);
    console.log(JSON.stringify(expenses, null, 2));

    console.log('\n--- Sample Supplier Invoices ---');
    const { data: invoices } = await supabase.from('store_supplier_invoices').select('id, invoice_date, total_amount, status').limit(5);
    console.log(JSON.stringify(invoices, null, 2));
}

checkSampleData();
