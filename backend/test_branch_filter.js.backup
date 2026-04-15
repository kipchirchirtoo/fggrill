require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFilter(branchId) {
    console.log(`\n=== TESTING FOR BRANCH ID: ${branchId} ===`);

    const { data: hotel } = await supabase.from('reservations')
        .select('confirmation_number, branch_id')
        .in('status', ['confirmed', 'checked_in'])
        .eq('branch_id', branchId)
        .limit(3);
    console.log(`[HOTEL] Found ${hotel?.length || 0} bills. Samples:`, hotel?.map(h => h.confirmation_number).join(', '));

    const { data: pos } = await supabase.from('shift_transactions')
        .select('transaction_number, branch_id')
        .eq('payment_method', 'BILL')
        .eq('is_voided', false)
        .eq('branch_id', branchId)
        .limit(3);
    console.log(`[POS] Found ${pos?.length || 0} bills. Samples:`, pos?.map(p => p.transaction_number).join(', '));
}

async function run() {
    await testFilter(1); // Bomet Town
    await testFilter(2); // Kyogong
}

run();
