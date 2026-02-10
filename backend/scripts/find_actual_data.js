const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findActualData() {
    console.log('=== Finding Actual Transaction Data ===\n');

    // Check restaurant_orders - get ANY records
    const { data: allRestOrders, error: restErr } = await supabase
        .from('restaurant_orders')
        .select('id, branch_id, total_amount, created_at, status')
        .limit(5);

    console.log('Restaurant Orders (any):');
    console.log('  Total found:', allRestOrders?.length || 0);
    if (allRestOrders && allRestOrders.length > 0) {
        console.log('  Sample records:');
        allRestOrders.forEach(order => {
            console.log(`    - Branch ${order.branch_id}, Amount: ${order.total_amount}, Date: ${order.created_at}, Status: ${order.status}`);
        });
    }
    if (restErr) console.log('  Error:', restErr.message);

    // Check expenses - get ANY records
    const { data: allExpenses, error: expErr } = await supabase
        .from('expenses')
        .select('id, branch_id, amount, category, expense_date')
        .limit(5);

    console.log('\nExpenses (any):');
    console.log('  Total found:', allExpenses?.length || 0);
    if (allExpenses && allExpenses.length > 0) {
        console.log('  Sample records:');
        allExpenses.forEach(exp => {
            console.log(`    - Branch ${exp.branch_id}, Amount: ${exp.amount}, Category: ${exp.category}, Date: ${exp.expense_date}`);
        });
    }
    if (expErr) console.log('  Error:', expErr.message);

    // Check bar_orders - get ANY records
    const { data: allBarOrders, error: barErr } = await supabase
        .from('bar_orders')
        .select('id, branch_id, total, created_at, status')
        .limit(5);

    console.log('\nBar Orders (any):');
    console.log('  Total found:', allBarOrders?.length || 0);
    if (allBarOrders && allBarOrders.length > 0) {
        console.log('  Sample records:');
        allBarOrders.forEach(order => {
            console.log(`    - Branch ${order.branch_id}, Total: ${order.total}, Date: ${order.created_at}, Status: ${order.status}`);
        });
    }
    if (barErr) console.log('  Error:', barErr.message);

    // Check branches to see what's available
    const { data: branches } = await supabase
        .from('branches')
        .select('id, name');

    console.log('\nAvailable Branches:');
    if (branches) {
        branches.forEach(b => console.log(`  - ID: ${b.id}, Name: ${b.name}`));
    }

    console.log('\n=== Analysis ===');
    if (allRestOrders && allRestOrders.length > 0) {
        const dates = allRestOrders.map(o => o.created_at);
        console.log('Restaurant order dates range from:', Math.min(...dates.map(d => new Date(d))), 'to', Math.max(...dates.map(d => new Date(d))));
    }
    if (allExpenses && allExpenses.length > 0) {
        const dates = allExpenses.map(e => e.expense_date);
        console.log('Expense dates range from:', Math.min(...dates.map(d => new Date(d))), 'to', Math.max(...dates.map(d => new Date(d))));
    }
}

findActualData();
