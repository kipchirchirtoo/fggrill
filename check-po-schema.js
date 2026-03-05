const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    try {
        // Check store_purchase_orders table structure
        const { data, error } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .limit(1);

        if (error) {
            console.log('Error querying table:', error);
        } else {
            console.log('Sample row (if exists):', data);
        }

        // Try to get column info using information_schema
        const { data: columns, error: colError } = await supabase
            .rpc('exec_sql', {
                query: `
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = 'store_purchase_orders'
                    ORDER BY ordinal_position;
                `
            });

        if (colError) {
            console.log('\nCannot query schema directly:', colError.message);
            console.log('\nTrying alternative method...');
            
            // Try inserting with minimal data to see what's required
            const testInsert = await supabase
                .from('store_purchase_orders')
                .insert({
                    po_number: 'TEST-001',
                    supplier_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
                    subtotal: 0,
                    tax_amount: 0,
                    total_amount: 0,
                    status: 'draft'
                })
                .select();

            console.log('\nTest insert result:', testInsert);
        } else {
            console.log('\nColumns:', columns);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchema();
