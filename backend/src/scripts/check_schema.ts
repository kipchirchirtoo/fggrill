import { supabase } from '../config/supabase';

async function main() {
    const tables = [
        'staff_profiles',
        'staff_payroll',
        'staff_credit_bills',
        'staff_advances',
        'staff_loans',
        'staff_loan_payments'
    ];

    for (const table of tables) {
        console.log(`\n=== Table: ${table} ===`);
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.log(`Failed to fetch ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log('Columns derived from first row:');
            console.log(Object.keys(data[0]).join(', '));
            console.log('Sample Data:', data[0]);
        } else {
            console.log(`No rows in ${table}, cannot dynamically determine columns via simple select.`);
            // Let's try to trigger a type error or insert fake data to get columns if needed, but for now this is ok.
        }
    }

    process.exit(0);
}

main().catch(console.error);
