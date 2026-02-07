
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('--- Debugging stock_counts relationships ---');

    // 1. Try ambiguous query to get hints
    console.log('\n1. Testing ambiguous query (user:users)...');
    const { data: data1, error: error1 } = await supabase
        .from('stock_counts')
        .select('id, user:users(id, first_name)')
        .limit(1);

    if (error1) {
        console.log('Error 1:', error1.message);
        if (error1.hint) console.log('Hint 1:', error1.hint);
        if (error1.details) console.log('Details 1:', error1.details);
    } else {
        console.log('Success 1 (Unexpected):', data1 ? 'Data found' : 'No data');
    }

    // 2. Try explicit FK 'stock_counts_counted_by_fkey' to users
    console.log('\n2. Testing explicit FK to users (stock_counts_counted_by_fkey)...');
    const { data: data2, error: error2 } = await supabase
        .from('stock_counts')
        .select('id, user:users!stock_counts_counted_by_fkey(id, first_name)')
        .limit(1);

    if (error2) {
        console.log('Error 2:', error2.message);
    } else {
        console.log('Success 2: Explicit FK stock_counts_counted_by_fkey works!');
    }

    // 3. Try to verify if counted_by exists and what it is
    console.log('\n3. Inspecting a raw row...');
    const { data: data3, error: error3 } = await supabase
        .from('stock_counts')
        .select('*')
        .limit(1);

    if (data3 && data3.length > 0) {
        console.log('Row keys:', Object.keys(data3[0]));
    }
}

debug().catch(console.error);
