const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrphanedExpense() {
    console.log('=== Fixing Orphaned Expense Record ===\n');

    // First, check the current state
    const { data: before, error: beforeError } = await supabase
        .from('expenses')
        .select('id, branch_id, amount, category, expense_date')
        .is('branch_id', null);

    console.log('Expenses with NULL branch_id:');
    if (before && before.length > 0) {
        console.log(`  Found ${before.length} record(s):`);
        before.forEach(exp => {
            console.log(`    - ID: ${exp.id}, Amount: ${exp.amount}, Category: ${exp.category}, Date: ${exp.expense_date}`);
        });
    } else {
        console.log('  None found (already fixed or no orphaned records)');
        return;
    }

    if (beforeError) {
        console.error('Error checking expenses:', beforeError.message);
        return;
    }

    // Apply the fix: Assign to Branch 2 (BOMET TOWN) since that's where the restaurant orders are
    console.log('\nApplying fix: Assigning branch_id = 2 to orphaned expenses...');

    const { data: updated, error: updateError, count } = await supabase
        .from('expenses')
        .update({ branch_id: 2 }, { count: 'exact' })
        .is('branch_id', null)
        .select();

    if (updateError) {
        console.error('Error updating expenses:', updateError.message);
        return;
    }

    console.log(`✓ Successfully updated ${updated?.length || 0} record(s)`);

    // Verify the fix
    const { data: after, error: afterError } = await supabase
        .from('expenses')
        .select('id, branch_id, amount, category, expense_date')
        .eq('branch_id', 2);

    console.log('\nExpenses now assigned to Branch 2:');
    if (after && after.length > 0) {
        after.forEach(exp => {
            console.log(`    - ID: ${exp.id}, Amount: ${exp.amount}, Category: ${exp.category}, Date: ${exp.expense_date}`);
        });
    }

    console.log('\n=== Fix Complete ===');
}

fixOrphanedExpense();
