const axios = require('axios');

async function testVerifyEndpoint() {
    console.log('=== Testing ID Verification Endpoint ===\n');

    const testIds = [
        'FG02001', // Example ID from the QR code
        'INVALID123' // Invalid ID to test error handling
    ];

    for (const id of testIds) {
        console.log(`Testing ID: ${id}`);
        try {
            const response = await axios.get(`http://localhost:5000/api/verify/${id}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            if (error.response) {
                console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('Error:', error.message);
                console.log('\nNote: Backend server may not be running. Start it with: cd backend && npm run dev');
            }
        }
        console.log('\n---\n');
    }

    console.log('=== Test Complete ===');
    console.log('\nTo test the full flow:');
    console.log('1. Start backend: cd backend && npm run dev');
    console.log('2. Start frontend: cd frontend && npm run dev');
    console.log('3. Visit: http://localhost:3000/verify?id=FG02001');
}

testVerifyEndpoint();
