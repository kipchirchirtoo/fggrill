/**
 * Diagnose Email Sending Issue
 * 
 * This script tests each component step by step to find the problem
 */

const axios = require('axios');
require('dotenv').config({ path: './.env' });

const testData = {
  firstName: 'Allan',
  lastName: 'Samuel',
  email: 'allansamuel571@gmail.com',
  phone: '+254 706 782 828',
  confirmationNumber: `HTL${Date.now()}`,
  checkInDate: 'March 15, 2026',
  checkOutDate: 'March 20, 2026',
  roomType: 'Deluxe Room',
  guests: 2,
  totalAmount: 15000,
  branchName: 'Famous Gate Hotel Bomet'
};

async function diagnose() {
  console.log('🔍 Diagnosing Email Sending Issue\n');
  console.log('='.repeat(60) + '\n');

  // Step 1: Check environment variables
  console.log('Step 1: Checking Environment Variables...');
  const brevoKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
  if (!brevoKey) {
    console.log('❌ BREVO_API_KEY not found in .env file!');
    console.log('   Please add BREVO_API_KEY to your .env file\n');
    return;
  }
  console.log(`✅ BREVO_API_KEY found: ${brevoKey.substring(0, 20)}...`);
  console.log(`✅ FROM_EMAIL: ${process.env.SMTP_FROM_EMAIL || 'info@famousgatehotels.com'}`);
  console.log(`✅ FROM_NAME: ${process.env.SMTP_FROM_NAME || 'FamousGate Hotels'}\n`);

  // Step 2: Check Python service
  console.log('Step 2: Checking Python PDF Service...');
  try {
    const pdfResponse = await axios.post(
      'http://localhost:5001/api/reports/generate/branded-pdf',
      {
        confirmationNumber: testData.confirmationNumber,
        guestName: `${testData.firstName} ${testData.lastName}`,
        email: testData.email,
        phone: testData.phone,
        checkInDate: testData.checkInDate,
        checkOutDate: testData.checkOutDate,
        roomType: testData.roomType,
        guests: testData.guests,
        totalAmount: testData.totalAmount
      },
      {
        responseType: 'arraybuffer',
        timeout: 10000
      }
    );
    console.log(`✅ Python service is running`);
    console.log(`✅ PDF generated successfully (${pdfResponse.data.byteLength} bytes)\n`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Python service is NOT running!');
      console.log('   Start it with: cd python-services && python barcode_app.py\n');
    } else {
      console.log(`⚠️  Python service error: ${error.message}`);
      console.log('   Email will be sent without PDF attachment\n');
    }
  }

  // Step 3: Check backend
  console.log('Step 3: Checking Backend Service...');
  try {
    const healthCheck = await axios.get('http://localhost:5000/health', { timeout: 5000 });
    console.log('✅ Backend is running\n');
  } catch (error) {
    console.log('❌ Backend is NOT running!');
    console.log('   Start it with: cd backend && npm run dev\n');
    return;
  }

  // Step 4: Test email endpoint
  console.log('Step 4: Testing Email Endpoint...');
  console.log(`Sending test email to: ${testData.email}\n`);
  
  try {
    const response = await axios.post(
      'http://localhost:5000/api/landing-email/confirmation',
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ SUCCESS! Email sent successfully!\n');
    console.log('Response:', response.data);
    console.log('\n' + '='.repeat(60));
    console.log('\n📬 Check your email inbox:');
    console.log(`   Email: ${testData.email}`);
    console.log(`   Subject: Booking Confirmation - ${testData.confirmationNumber}`);
    console.log('\n✓ What to verify:');
    console.log('   1. Email received');
    console.log('   2. Professional document design');
    console.log('   3. Phone: +254 706 782 828');
    console.log('   4. PDF invoice attached');
    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.log('❌ FAILED to send email!\n');
    
    if (error.response) {
      console.log('Error Response:');
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Message: ${error.response.data?.message || error.response.statusText}`);
      console.log(`  Details:`, error.response.data);
      
      if (error.response.status === 404) {
        console.log('\n💡 The endpoint might not be registered.');
        console.log('   Check backend/src/app.ts to ensure landing-email routes are registered.');
      } else if (error.response.status === 500) {
        console.log('\n💡 Server error. Check backend logs for details.');
      }
    } else if (error.request) {
      console.log('No response from backend.');
      console.log('Make sure backend is running on http://localhost:5000');
    } else {
      console.log('Error:', error.message);
    }
    
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('   1. Check backend logs for errors');
    console.log('   2. Verify BREVO_API_KEY is valid');
    console.log('   3. Check if sender email is verified in Brevo');
    console.log('   4. Restart backend: cd backend && npm run dev');
    console.log('   5. Restart Python: cd python-services && python barcode_app.py\n');
  }
}

// Run diagnosis
diagnose().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
