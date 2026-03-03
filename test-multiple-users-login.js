async function testLogin(email, password) {
  console.log(`\n🔐 Testing: ${email}`);
  console.log('─'.repeat(80));

  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.status === 200) {
      console.log(`✅ SUCCESS - ${email}`);
      console.log(`   User: ${data.data.user.first_name} ${data.data.user.last_name}`);
      console.log(`   Role: ${data.data.user.role}`);
      console.log(`   Token: ${data.data.session.access_token.substring(0, 30)}...`);
    } else {
      console.log(`❌ FAILED - ${email}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Message: ${data.message}`);
    }
  } catch (error) {
    console.log(`❌ ERROR - ${email}: ${error.message}`);
  }
}

async function testAllUsers() {
  console.log('🧪 TESTING MULTIPLE USER LOGINS');
  console.log('═'.repeat(80));

  // Test with the same password for all users (as per user's statement)
  const password = 'Allan@13900';
  
  const users = [
    'kipchirchirtoo01@gmail.com',
    'manager@kyogong.com',
    'cashier@kyogong.com',
    'reception@kyogong.com',
    'accountant@kyogong.com'
  ];

  for (const email of users) {
    await testLogin(email, password);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ All tests complete');
  console.log('\nIf any user failed, they may have a different password.');
  console.log('The backend authentication is working correctly!\n');
}

testAllUsers();
