const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Mock env from .env.example values if .env is missing
const config = {
    SUPABASE_PROJECT_URL: 'https://utsvlihpudfraxzcmtle.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING'
};

const supabase = createClient(config.SUPABASE_PROJECT_URL, config.SUPABASE_SERVICE_ROLE_KEY);

async function testServiceFetch() {
    try {
        const branchId = null;
        const status = undefined;

        let query = supabase
            .from('stock_requests')
            .select('*, requesting_branch:branches!requesting_branch_id(name)')
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.eq('requesting_branch_id', branchId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query;
        if (error) {
            console.error('Fetch Error:', error);
            return;
        }

        console.log(`Found ${requests?.length} requests.`);
        if (requests && requests.length > 0) {
            console.log('Sample request:', JSON.stringify(requests[0], null, 2));
        }

    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

testServiceFetch();
