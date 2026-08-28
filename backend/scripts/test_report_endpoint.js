const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReportEndpoint() {
    console.log('=== Testing Updated Report Endpoint ===\n');

    // Test 1: Branch 1 (should return "no data" message)
    console.log('Test 1: Branch 1 (KYOGONG) - Feb 2026');
    console.log('Expected: No data message with helpful suggestion\n');

    const test1Params = {
        branch_id: 1,
        start_date: '2026-02-01',
        end_date: '2026-02-28'
    };

    try {
        const response1 = await axios.get('http://localhost:5000/api/reports/auditor/performance', {
            params: test1Params,
            headers: {
                'Authorization': 'Bearer test-token' // You may need a real token
            }
        });
        console.log('Response:', JSON.stringify(response1.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
            console.log('Note: Backend server may not be running. Start it with: npm run dev');
        }
    }

    console.log('\n---\n');

    // Test 2: Branch 2 (should return actual data)
    console.log('Test 2: Branch 2 (BOMET TOWN) - Feb 2026');
    console.log('Expected: Actual sales data (3 restaurant orders)\n');

    const test2Params = {
        branch_id: 2,
        start_date: '2026-02-01',
        end_date: '2026-02-28'
    };

    try {
        const response2 = await axios.get('http://localhost:5000/api/reports/auditor/performance', {
            params: test2Params
        });
        console.log('Response:', JSON.stringify(response2.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }

    console.log('\n=== Test Complete ===');
    console.log('If backend is not running, start it with: cd backend && npm run dev');
}

testReportEndpoint();
