/**
 * Test Brevo API Direct Email Sending
 * 
 * This script tests sending emails directly via Brevo API
 */

const axios = require('axios');
require('dotenv').config({ path: './.env' });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testBrevoAPI() {
  try {
    console.log('🧪 Testing Brevo API Email Sending\n');
    console.log('📋 Configuration:');
    console.log(`   API Key: ${process.env.BREVO_API_KEY?.substring(0, 20)}...`);
    console.log(`   FROM: ${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`);
    console.log();

    const testBookingDetails = {
      firstName: 'Allan',
      lastName: 'Kipchirchir',
      email: 'kipchirchirtoo01@gmail.com',
      confirmationNumber: 'BREVO-TEST-' + Date.now(),
      checkInDate: '2026-03-20',
      checkOutDate: '2026-03-22',
      roomType: 'Executive Suite',
      guests: 2,
      totalAmount: 25000,
      branchName: 'FamousGate Hotels - Bomet'
    };

    console.log('📧 Sending test booking confirmation email via Brevo API...');
    console.log('   To:', testBookingDetails.email);
    console.log('   Confirmation:', testBookingDetails.confirmationNumber);
    console.log('   Check-in:', testBookingDetails.checkInDate);
    console.log('   Check-out:', testBookingDetails.checkOutDate);
    console.log('   Room:', testBookingDetails.roomType);
    console.log('   Guests:', testBookingDetails.guests);
    console.log('   Amount: KES', testBookingDetails.totalAmount.toLocaleString());
    console.log();

    const response = await axios.post(
      `${BACKEND_URL}/api/landing-email/confirmation`,
      testBookingDetails,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.status === 200) {
      console.log('✅ Email sent successfully via Brevo API!');
      console.log('   Response:', response.data);
      console.log();
      console.log('📬 Check the inbox for:', testBookingDetails.email);
      console.log('   Subject: Booking Confirmation - ' + testBookingDetails.confirmationNumber);
      console.log('   FROM: FamousGate Hotels <info@famousgatehotels.com>');
      console.log();
      console.log('✅ Brevo API integration test completed successfully!');
      console.log();
      console.log('🎉 The email system is now working with Brevo API!');
    } else {
      console.error('❌ Unexpected response status:', response.status);
      console.error('   Response:', response.data);
    }

  } catch (error) {
    console.error('❌ Error testing Brevo API:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting Brevo API email test...\n');
testBrevoAPI()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
