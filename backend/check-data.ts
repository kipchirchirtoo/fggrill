import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const tables = [
        'finance_transactions',
        'expenses',
        'bookings',
        'restaurant_orders',
        'bar_orders',
        'accounting_ar_invoices'
    ];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`${table}: Error - ${error.message}`);
        } else {
            console.log(`${table}: ${count} rows`);
        }
    }
}

checkData();
