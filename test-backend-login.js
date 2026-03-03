async function testBackendLogin() {
  console.log('🧪 Testing Backend Login Endpoint');
  console.log('═'.repeat(80));
  
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'Allan@13900';
  const backendUrl = 'http://localhost:5000';

  console.log(`\n📍 Backend URL: ${backendUrl}`);
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}\n`);

  try {
    console.log('🔄 Sending POST request to /api/auth/login...\n');

    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log('─'.repeat(80));

    const data = await response.json();

    if (response.status === 200) {
      console.log('✅ LOGIN SUCCESSFUL!');
      console.log('\nResponse Data:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.data?.session?.access_token) {
        console.log('\n✅ Access token received');
        console.log(`   Token preview: ${data.data.session.access_token.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ LOGIN FAILED!');
      console.log('\nResponse Data:');
      console.log(JSON.stringify(data, null, 2));
      
      if (response.status === 401) {
        console.log('\n⚠️  401 Unauthorized - Invalid credentials');
        console.log('   This means the backend rejected the password.');
        console.log('   Checking backend logs for more details...');
      }
    }

  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.log('❌ CONNECTION REFUSED');
      console.log('   Backend server is not running on port 5000');
      console.log('   Start the backend with: cd backend && npm start');
    } else {
      console.log('❌ ERROR:', error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
}

testBackendLogin();
