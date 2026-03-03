// Simulate the exact frontend login flow
async function testFrontendLoginFlow() {
  console.log('🧪 SIMULATING FRONTEND LOGIN FLOW');
  console.log('═'.repeat(80));

  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'Allan@13900';
  const API_URL = 'http://localhost:5000';

  console.log(`\n📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`🌐 API URL: ${API_URL}\n`);

  try {
    console.log('🔄 Step 1: Making POST request to /api/auth/login...');
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({ email, password })
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response Headers:`, Object.fromEntries(response.headers.entries()));

    const data = await response.json();

    if (!response.ok) {
      console.log('\n❌ Response NOT OK');
      console.log('Response Data:', JSON.stringify(data, null, 2));
      
      if (response.status === 401) {
        console.log('\n⚠️  401 UNAUTHORIZED');
        console.log('   This is what the frontend sees!');
        console.log(`   Error message: ${data.message || data.error || 'Unknown error'}`);
      }
      return;
    }

    console.log('\n✅ Response OK');
    console.log('Response Data:', JSON.stringify(data, null, 2));

    if (data.success && data.data?.session?.access_token) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
      console.log(`   Token: ${data.data.session.access_token.substring(0, 50)}...`);
      console.log(`   User: ${data.data.user.first_name} ${data.data.user.last_name}`);
      console.log(`   Role: ${data.data.user.role}`);
    }

  } catch (error) {
    console.log('\n❌ FETCH ERROR:', error.message);
    if (error.cause) {
      console.log('   Cause:', error.cause);
    }
  }

  console.log('\n' + '═'.repeat(80));
}

testFrontendLoginFlow();
