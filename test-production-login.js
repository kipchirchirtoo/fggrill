/**
 * Test Production Login
 * Verify that login works with the new password
 */

async function testLogin() {
  console.log('🧪 Testing Production Login\n');
  console.log('API: https://api.hirall.com/api/auth/login');
  console.log('Password: Allan@13900\n');
  
  const testUsers = [
    'manager@famousgate.com',
    'cashier@famousgate.com',
    'don@famousgate.com'
  ];
  
  for (const email of testUsers) {
    console.log(`\nTesting: ${email}`);
    console.log('─'.repeat(50));
    
    try {
      const response = await fetch('https://api.hirall.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: 'Allan@13900'
        })
      });
      
      const data = await response.json();
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('✅ LOGIN SUCCESS');
        console.log(`   User: ${data.data?.user?.first_name} ${data.data?.user?.last_name}`);
        console.log(`   Role: ${data.data?.user?.role}`);
        console.log(`   Token: ${data.data?.session?.access_token?.substring(0, 20)}...`);
      } else {
        console.log('❌ LOGIN FAILED');
        console.log(`   Error: ${data.message || 'Unknown error'}`);
        console.log(`   Response:`, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.log('❌ REQUEST FAILED');
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('DIAGNOSIS');
  console.log('═'.repeat(50));
  console.log('\nIf all logins failed with 401:');
  console.log('  1. Backend server needs restart');
  console.log('  2. Backend is using cached database connection');
  console.log('  3. Backend .env has wrong database credentials');
  console.log('\nIf some logins work:');
  console.log('  ✅ Password fix worked!');
  console.log('  ✅ Backend is working correctly');
  console.log('\nNext steps:');
  console.log('  - Restart backend server');
  console.log('  - Check backend logs');
  console.log('  - Verify backend .env file');
}

testLogin().catch(console.error);
