import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://utsvlihpudfraxzcmtle.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function test() {
    console.log('Testing Supabase RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT NOW()' });
    if (error) {
        console.error('Failure:', error);
    } else {
        console.log('Success:', data);
    }
}

test();
