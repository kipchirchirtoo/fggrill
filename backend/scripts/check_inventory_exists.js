
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventory() {
    console.log('Checking store_inventory table...');
    const { data, error, count } = await supabase
        .from('store_inventory')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.log('Error accessing store_inventory:', error.message);
    } else {
        console.log(`store_inventory exists. Count: ${count}`);
    }

    console.log('Checking store_requisitions table...');
    const { data: reqData, error: reqError, count: reqCount } = await supabase
        .from('store_requisitions')
        .select('*', { count: 'exact', head: true });

    if (reqError) {
        console.log('Error accessing store_requisitions:', reqError.message);
    } else {
        console.log(`store_requisitions exists. Count: ${reqCount}`);
    }
}

checkInventory();
