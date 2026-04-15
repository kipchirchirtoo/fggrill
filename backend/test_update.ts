
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log('Testing unpaid_bills update...');
    const billId = '34403140-73da-403f-bbd9-610843797cac'; // BILL000001

    // Fetch current
    const { data: bill , error } = await supabase.from('unpaid_bills').select('*').eq('id', billId).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log('Current bill:', bill);

    if (bill) {
        const amount = 2000;
        const newPaidAmount = (Number(bill.paid_amount) || 0) + amount;
        const totalAmount = Number(bill.total_amount);
        const newBalance = Math.max(0, totalAmount - newPaidAmount);
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';

        console.log('Calculated update:', { newPaidAmount, newBalance, newStatus });

        const { data: updated, error } = await supabase
            .from('unpaid_bills')
            .update({
                paid_amount: newPaidAmount,
                balance_amount: newBalance,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', billId)
            .select();

        if (error) {
            console.error('Update failed:', error);
        } else {
            console.log('Update success:', updated);
        }
    }

    console.log('\nTesting accounting_ar_invoices update...');
    const invId = '1f31c82e-23a0-4580-bcaf-8281bcf74661'; // INV-1770999425477

    const { data: inv , error } = await supabase.from('accounting_ar_invoices').select('*').eq('id', invId).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log('Current invoice:', inv);

    if (inv) {
        const amount = 30000;
        const newBalance = Math.max(0, Number(inv.balance) - amount);
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';

        console.log('Calculated update:', { newBalance, newStatus });

        const { data: updated, error } = await supabase
            .from('accounting_ar_invoices')
            .update({
                balance: newBalance,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', invId)
            .select();

        if (error) {
            console.error('Update failed:', error);
        } else {
            console.log('Update success:', updated);
        }
    }
}

testUpdate();
