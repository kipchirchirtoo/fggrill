const fetch = require('node-fetch');

const API_URL = 'http://localhost:5000';

// Get token from your browser's localStorage or use a test token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace with actual token

async function testKitchenUsageAPI() {
  console.log('Testing Kitchen Usage API...\n');

  try {
    // Test 1: Get trackable items
    console.log('1. Testing GET /api/store/kitchen-usage/trackable-items');
    const trackableResponse = await fetch(`${API_URL}/api/store/kitchen-usage/trackable-items`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const trackableData = await trackableResponse.json();
    console.log('Status:', trackableResponse.status);
    console.log('Response:', JSON.stringify(trackableData, null, 2));
    console.log('Items count:', trackableData.data?.length || 0);
    
    if (trackableData.data && trackableData.data.length > 0) {
      console.log('\nSample item:', JSON.stringify(trackableData.data[0], null, 2));
    }

    console.log('\n---\n');

    // Test 2: Get kitchen usage records
    console.log('2. Testing GET /api/store/kitchen-usage');
    const recordsResponse = await fetch(`${API_URL}/api/store/kitchen-usage`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const recordsData = await recordsResponse.json();
    console.log('Status:', recordsResponse.status);
    console.log('Response:', JSON.stringify(recordsData, null, 2));
    console.log('Records count:', recordsData.data?.length || 0);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run without token to see the error
async function testWithoutToken() {
  console.log('\n\n=== Testing without token ===\n');
  
  try {
    const response = await fetch(`${API_URL}/api/store/kitchen-usage/trackable-items`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

console.log('=== Kitchen Usage API Test ===\n');
console.log('NOTE: Update the TOKEN variable with a valid token from your browser\n');
console.log('To get token:');
console.log('1. Open browser DevTools (F12)');
console.log('2. Go to Application > Local Storage');
console.log('3. Find "token" key and copy its value\n');

testWithoutToken();
// Uncomment below after adding token
// testKitchenUsageAPI();
