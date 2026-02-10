
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');


const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);



async function listTables() {
    console.log('Listing all tables in public schema...');

    // Using a raw query via a workaround if direct SQL isn't enabled, 
    // but standard PostgREST doesn't expose arbitrary SQL. 
    // Instead, let's try to fetch from a known table that might have schema info or just iterate common ones.
    // Actually, we can use the 'pg_catalog' or 'information_schema' if exposed.
    // Let's try to guess more tables or just assume the data is missing.

    // Better approach: Check for "store_" tables which are likely for Central Store
    const storeTables = [
        'store_items',
        'store_inventory',
        'store_stock_movements',
        'store_suppliers',
        'store_supplier_invoices',
        'store_purchase_orders',
        'store_grn',
        'store_grni_control_account',
        'store_requisitions'
    ];

    console.log('\n--- Checking Central Store Tables ---');
    for (const table of storeTables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`[MISSING/ERROR] ${table}: ${error.message}`);
        } else {
            console.log(`[EXISTS] ${table} (Count: ${count})`);
        }
    }
}


listTables();
