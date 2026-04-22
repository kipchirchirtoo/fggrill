/**
 * Test mobile login endpoint
 */

const axios = require('axios');

async function testLogin() {
  const email = process.argv[2] || 'sharonchepkemoi@famousgate.com';
  const password = process.argv[3] || 'test123';

  console.log(`🔐 Testing login for: ${email}`);
  console.log(`📍 API: http://192.168.100.6:5000/api/auth/login\n`);

  try {
    const response = await axios.post('http://192.168.100.6:5000/api/auth/login', {
      email,
      password,
    });

    console.log('✅ Login successful!');
    console.log('\n📦 Response data:');
    console.log(JSON.stringify(response.data, null, 2));

    // Check what the mobile app needs
    const hasToken = response.data.token || response.data.access_token;
    const hasUser = response.data.user;

    console.log('\n🔍 Mobile app requirements:');
    console.log(`   ✅ Has token: ${!!hasToken}`);
    console.log(`   ✅ Has user: ${!!hasUser}`);

    if (hasUser) {
      console.log(`\n👤 User info:`);
      console.log(`   Name: ${hasUser.first_name} ${hasUser.last_name}`);
      console.log(`   Role: ${hasUser.role}`);
      console.log(`   Branch: ${hasUser.branch_name || hasUser.branch?.name || 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ Login failed!');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else {
      console.error(`   Error:`, error.message);
    }
  }
}

testLogin();
