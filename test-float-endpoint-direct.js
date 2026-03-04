// Test the float endpoint directly
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://famousgate.hirall.com';

async function testFloatEndpoint() {
    console.log('Testing float endpoint...');
    console.log('API URL:', API_URL);
    
    const shiftId = '60c1793d-8e80-42a0-b7a8-2910808f9a6c';
    const url = `${API_URL}/api/kyogong/shifts/${shiftId}/float`;
    
    console.log('\nTesting URL:', url);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${process.env.TEST_TOKEN || 'YOUR_TOKEN_HERE'}`
            }
        });
        
        console.log('\nResponse status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('\nResponse data:', JSON.stringify(data, null, 2));
        
        if (response.status === 404) {
            console.log('\n❌ STILL GETTING 404!');
            console.log('This means the backend server needs to be restarted.');
        } else if (response.status === 200) {
            console.log('\n✅ Float endpoint is working!');
        } else {
            console.log(`\n⚠️  Unexpected status: ${response.status}`);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testFloatEndpoint();
