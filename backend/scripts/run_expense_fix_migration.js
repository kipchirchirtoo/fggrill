const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('=== Running Migration: Fix Orphaned Expense ===\n');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260210_fix_orphaned_expense.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon to execute statements separately
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

    for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;

        console.log('Executing:', trimmed.substring(0, 100) + '...');

        const { data, error } = await supabase.rpc('run_dynamic_query', {
            query_text: trimmed
        });

        if (error) {
            console.error('Error:', error.message);
            // Try direct approach if RPC fails
            console.log('Trying alternative approach...');
            break;
        } else {
            console.log('✓ Success');
            if (data) console.log('Result:', data);
        }
    }

    // Verify the fix directly
    console.log('\n=== Verifying Fix ===');
    const { data: expenses, error } = await supabase
        .from('expenses')
        .select('id, branch_id, amount, category, expense_date')
        .eq('expense_date', '2026-01-04');

    if (error) {
        console.error('Error verifying:', error.message);
    } else {
        console.log('Expenses for 2026-01-04:');
        expenses?.forEach(exp => {
            console.log(`  - ID: ${exp.id}, Branch: ${exp.branch_id}, Amount: ${exp.amount}, Category: ${exp.category}`);
        });
    }
}

runMigration();
