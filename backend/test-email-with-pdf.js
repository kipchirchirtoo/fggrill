/**
 * Test Email with PDF Attachment
 * 
 * This script tests the complete email flow with PDF invoice attachment
 */

const axios = require('axios');

const testBookingData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'test@example.com', // Change this to your test email
  phone: '+254 706 782 828',
  confirmationNumber: 'HTL260306-TEST',
  checkInDate: 'March 10, 2026',
  checkOutDate: 'March 15, 2026',
  roomType: 'Deluxe Room',
  guests: 2,
  totalAmount: 15000,
  branchName: 'Famous Gate Hotel Bomet'
};

async function testEmailWithPDF() {
  console.log('🧪 Testing Email with PDF Attachment\n');
  console.log('Test Data:', JSON.stringify(testBookingData, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Step 1: Test Python PDF service
    console.log('📄 Step 1: Testing PDF generation service...');
    const pdfResponse = await axios.post(
      'http://localhost:5001/api/reports/generate/branded-pdf',
      {
        confirmationNumber: testBookingData.confirmationNumber,
        guestName: `${testBookingData.firstName} ${testBookingData.lastName}`,
        email: testBookingData.email,
        phone: testBookingData.phone,
        checkInDate: testBookingData.checkInDate,
        checkOutDate: testBookingData.checkOutDate,
        roomType: testBookingData.roomType,
        guests: testBookingData.guests,
        totalAmount: testBookingData.totalAmount
      },
      {
        responseType: 'arraybuffer'
      }
    );

    console.log('✅ PDF generated successfully');
    console.log(`   Size: ${pdfResponse.data.byteLength} bytes`);
    console.log(`   Content-Type: ${pdfResponse.headers['content-type']}`);
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 2: Test email sending with PDF
    console.log('📧 Step 2: Testing email with PDF attachment...');
    const emailResponse = await axios.post(
      'http://localhost:5000/api/landing-email/confirmation',
      testBookingData
    );

    console.log('✅ Email sent successfully');
    console.log('   Response:', emailResponse.data);
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('Next steps:');
    console.log('1. Check your email inbox for the confirmation email');
    console.log('2. Verify the email has the correct phone number (+254 706 782 828)');
    console.log('3. Verify the PDF invoice is attached');
    console.log('4. Open the PDF and check the formatting');

  } catch (error) {
    console.error('❌ TEST FAILED\n');
    
    if (error.response) {
      console.error('Error Response:');
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('  Make sure both services are running:');
      console.error('  - Backend: http://localhost:5000');
      console.error('  - Python: http://localhost:5001');
    } else {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testEmailWithPDF();
