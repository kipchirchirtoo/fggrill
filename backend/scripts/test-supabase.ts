import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://utsvlihpudfraxzcmtle.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
