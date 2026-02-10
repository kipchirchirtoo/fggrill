const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuditorReport() {
    console.log('=== Testing Auditor Branch Performance Report Logic ===\n');

    // Simulate the controller logic from auditor-reports.controller.ts
    const branch_id = 1; // Using branch 1
    const start_date = '2026-02-01';
    const end_date = '2026-02-28';

    console.log(`Branch: ${branch_id}, Date Range: ${start_date} to ${end_date}\n`);

    // 1. Restaurant Sales
    const { data: restSales, error: restError } = await supabase
        .from('restaurant_orders')
        .select('total_amount, created_at')
        .eq('branch_id', branch_id)
        .gte('created_at', start_date)
        .lte('created_at', end_date)
        .neq('status', 'cancelled');

    console.log('Restaurant Orders:');
    console.log('  Count:', restSales?.length || 0);
    if (restSales && restSales.length > 0) {
        console.log('  Sample:', restSales[0]);
    }
    if (restError) console.log('  Error:', restError.message);

    // 2. Bar Sales
    const { data: barSales, error: barError } = await supabase
        .from('bar_orders')
        .select('total, created_at')
        .eq('branch_id', branch_id)
        .gte('created_at', start_date)
        .lte('created_at', end_date)
        .neq('status', 'cancelled');

    console.log('\nBar Orders:');
    console.log('  Count:', barSales?.length || 0);
    if (barError) console.log('  Error:', barError.message);

    // 3. Expenses
    const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount, category, expense_date')
        .eq('branch_id', branch_id)
        .gte('expense_date', start_date)
        .lte('expense_date', end_date);

    console.log('\nExpenses:');
    console.log('  Count:', expenses?.length || 0);
    if (expenses && expenses.length > 0) {
        console.log('  Sample:', expenses[0]);
    }
    if (expError) console.log('  Error:', expError.message);

    // Calculate totals
    const totalRestSales = restSales?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;
    const totalBarSales = barSales?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;
    const totalSales = totalRestSales + totalBarSales;
    const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0;
    const netProfit = totalSales - totalExpenses;

    console.log('\n=== Report Summary ===');
    console.log('Total Restaurant Sales:', totalRestSales);
    console.log('Total Bar Sales:', totalBarSales);
    console.log('Total Sales:', totalSales);
    console.log('Total Expenses:', totalExpenses);
    console.log('Net Profit:', netProfit);
    console.log('Profit Margin:', totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(2) + '%' : '0%');
}

testAuditorReport();
