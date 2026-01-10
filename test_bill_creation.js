// Simple test to create a bill and see the exact error
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function testBillCreation() {
    console.log('='.repeat(80));
    console.log('TESTING BILL CREATION - DIAGNOSTIC');
    console.log('='.repeat(80));

    // First, check if suppliers table exists and has data
    console.log('\n1. Checking suppliers table...');
    const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .limit(5);

    if (suppliersError) {
        console.error('ERROR fetching suppliers:', suppliersError);
    } else {
        console.log(`Found ${suppliers?.length || 0} suppliers:`);
        suppliers?.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
    }

    // Check accounting_vendors table
    console.log('\n2. Checking accounting_vendors table...');
    const { data: vendors, error: vendorsError } = await supabase
        .from('accounting_vendors')
        .select('*')
        .limit(5);

    if (vendorsError) {
        console.error('ERROR fetching accounting_vendors:', vendorsError);
    } else {
        console.log(`Found ${vendors?.length || 0} accounting vendors:`);
        vendors?.forEach(v => console.log(`  - ${v.id}: ${v.vendor_name} (code: ${v.vendor_code || 'N/A'})`));
    }

    // Check accounting_ap_bills table structure
    console.log('\n3. Checking accounting_ap_bills table structure...');
    const { data: bills, error: billsError } = await supabase
        .from('accounting_ap_bills')
        .select('*')
        .limit(1);

    if (billsError) {
        console.error('ERROR fetching bills:', billsError);
    } else {
        console.log('Bills table exists. Sample structure:', bills?.[0] || 'No bills yet');
    }

    // Try to create a bill with a test vendor_id
    console.log('\n4. Attempting to create a test bill...');

    if (suppliers && suppliers.length > 0) {
        const testSupplierId = suppliers[0].id;
        console.log(`Using supplier ID: ${testSupplierId}`);

        const { data: newBill, error: createError } = await supabase
            .from('accounting_ap_bills')
            .insert([{
                bill_number: `TEST-BILL-${Date.now()}`,
                vendor_id: testSupplierId,
                bill_date: new Date().toISOString().split('T')[0],
                due_date: new Date().toISOString().split('T')[0],
                subtotal: 100.00,
                tax_amount: 0,
                total_amount: 100.00,
                balance: 100.00,
                status: 'unpaid',
                notes: 'Test bill for diagnostic purposes'
            }])
            .select()
            .single();

        if (createError) {
            console.error('\n❌ ERROR creating bill:');
            console.error('Message:', createError.message);
            console.error('Details:', createError.details);
            console.error('Hint:', createError.hint);
            console.error('Code:', createError.code);
        } else {
            console.log('\n✅ Bill created successfully!');
            console.log('Bill ID:', newBill.id);

            // Clean up - delete the test bill
            await supabase.from('accounting_ap_bills').delete().eq('id', newBill.id);
            console.log('Test bill deleted.');
        }
    } else {
        console.log('⚠️  No suppliers found to test with!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80));
}

testBillCreation().catch(console.error);
