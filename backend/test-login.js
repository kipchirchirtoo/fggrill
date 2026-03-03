const axios = require('axios');

async function testLogin() {
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'Allan@13900';
  
  console.log('='.repeat(60));
  console.log('TESTING LOGIN');
  console.log('='.repeat(60));
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);
  
  try {
    console.log('Sending login request to http://localhost:5000/api/auth/login...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: email,
      password: password
    });
    
    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('\nResponse:');
    console.log('- Success:', response.data.success);
    console.log('- User ID:', response.data.data.user.id);
    console.log('- User Name:', response.data.data.user.first_name, response.data.data.user.last_name);
    console.log('- User Role:', response.data.data.user.role);
    console.log('- User Email:', response.data.data.user.email);
    console.log('- Has Session:', !!response.data.data.session);
    console.log('- Access Token:', response.data.data.session.access_token.substring(0, 50) + '...');
    
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS! You can now login with these credentials');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ LOGIN FAILED!');
    
    if (error.response) {
      console.error('\nServer Response:');
      console.error('- Status:', error.response.status);
      console.error('- Message:', error.response.data.message || error.response.data);
    } else if (error.request) {
      console.error('\nNo response from server. Is the backend running on port 5000?');
    } else {
      console.error('\nError:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TROUBLESHOOTING');
    console.log('='.repeat(60));
    console.log('1. Make sure backend is running: npm run dev (in backend folder)');
    console.log('2. Check backend logs for errors');
    console.log('3. Verify password was set correctly');
    console.log('4. Check database connection');
  }
}

testLogin();
