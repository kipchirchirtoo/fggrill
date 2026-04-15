const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/Users/user/Desktop/fggrill/backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateData() {
    console.log('Starting data migration to staff_payroll_adjustments...');

    try {
        // 1. Fetch from staff_advances
        const { data: advances, error: advError } = await supabase
            .from('staff_advances')
            .select('*')
            .neq('status', 'applied'); // Only pending ones

        if (advError) throw advError;
        console.log(`Found ${advances.length} pending advances.`);

        for (const adv of advances) {
            if (!adv.staff_id) {
                console.log(`Skipping advance ${adv.id} due to missing staff_id`);
                continue;
            }
            const { error } = await supabase.from('staff_payroll_adjustments').insert({
                staff_id: adv.staff_id,
                type: 'deduction',
                category: 'advance',
                amount: adv.amount,
                description: adv.notes || 'Migrated from staff_advances',
                month: String(new Date(adv.created_at).getMonth() + 1),
                year: new Date(adv.created_at).getFullYear(),
                status: 'pending',
                created_at: adv.created_at
            });
            if (error) console.error(`Error migrating advance ${adv.id}:`, error);
            else console.log(`Migrated advance ${adv.id}`);
        }

        // 2. Fetch from staff_loans (this is trickier as loans have installments, but for a simple fix we migrate the pending deduction if any)
        const { data: loans, error: loanError } = await supabase
            .from('staff_loans')
            .select('*')
            .eq('status', 'active');

        if (loanError) throw loanError;
        console.log(`Found ${loans.length} active loans.`);

        for (const loan of loans) {
            if (!loan.staff_id) {
                console.log(`Skipping loan ${loan.id} due to missing staff_id`);
                continue;
            }
            // Migrate the installment amount
            const { error } = await supabase.from('staff_payroll_adjustments').insert({
                staff_id: loan.staff_id,
                type: 'deduction',
                category: 'loan_installment',
                amount: loan.monthly_installment || (loan.total_amount / loan.installments) || 0,
                description: `Loan installment (Total: ${loan.total_amount})`,
                month: String(new Date().getMonth() + 1),
                year: new Date().getFullYear(),
                status: 'pending',
                created_at: loan.created_at
            });
            if (error) console.error(`Error migrating loan ${loan.id}:`, error);
            else console.log(`Migrated loan installment for loan ${loan.id}`);
        }

        // 3. staff_credit_bills
        const { data: bills, error: billError } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('status', 'unpaid');

        if (billError) throw billError;
        console.log(`Found ${bills.length} unpaid credit bills.`);

        for (const bill of bills) {
            if (!bill.staff_id) {
                console.log(`Skipping bill ${bill.id} due to missing staff_id`);
                continue;
            }
            const { error } = await supabase.from('staff_payroll_adjustments').insert({
                staff_id: bill.staff_id,
                type: 'deduction',
                category: 'credit_bill',
                amount: bill.total_amount,
                description: `Credit bill: ${bill.bill_number || bill.id}`,
                month: String(new Date(bill.created_at).getMonth() + 1),
                year: new Date(bill.created_at).getFullYear(),
                status: 'pending',
                created_at: bill.created_at
            });
            if (error) console.error(`Error migrating bill ${bill.id}:`, error);
            else console.log(`Migrated bill ${bill.id}`);
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrateData();
