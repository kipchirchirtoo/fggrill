const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyFixes() {
    try {
        console.log('--- Verifying Users ---');
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('role', 'central_operations_manager');

        console.log(`Found ${users?.length || 0} users with central_operations_manager role.`);
        if (users?.length > 0) {
            console.log('Sample user:', users[0]);
        } else {
            console.log('No central_operations_manager found. Make sure validation allows this role.');
        }

        console.log('\n--- Verifying Stock Requests ---');
        const { data: requests, error: reqError } = await supabase
            .from('stock_requests')
            .select('id, status, requesting_branch_id')
            .limit(5);

        if (reqError) {
            console.error('Error fetching requests:', reqError);
        } else {
            console.log(`Fetched ${requests.length} requests.`);
            const pending = requests.filter(r => r.status === 'PENDING');
            console.log(`Pending requests in sample: ${pending.length}`);
        }

        console.log('\n--- Verifying Detailed Items ---');
        if (requests && requests.length > 0) {
            const reqId = requests[0].id;
            const { data: items, error: itemError } = await supabase
                .from('stock_request_items')
                .select('id, approved_quantity, status')
                .eq('request_id', reqId);

            if (itemError) {
                console.error('Error fetching items:', itemError);
            } else {
                console.log(`Fetched ${items.length} items for request ${reqId}.`);
                console.log('Sample item:', items[0]);
            }
        }

    } catch (err) {
        console.error('Verification Fatal Error:', err);
    }
}

verifyFixes();
