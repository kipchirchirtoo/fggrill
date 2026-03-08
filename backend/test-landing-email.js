/**
 * Test Landing Page Booking Confirmation Email
 * 
 * This script tests sending a booking confirmation email from the landing page
 */

const axios = require('axios');
require('dotenv').config({ path: './.env' });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testLandingEmail() {
  try {
    console.log('🧪 Testing Landing Page Booking Confirmation Email\n');

    const testBookingDetails = {
      firstName: 'Test',
      lastName: 'User',
      email: 'kipchirchirtoo01@gmail.com', // Use a real email for testing
      confirmationNumber: 'TEST-' + Date.now(),
      checkInDate: '2026-03-15',
      checkOutDate: '2026-03-17',
      roomType: 'Deluxe Room',
      guests: 2,
      totalAmount: 15000,
      branchName: 'Famous Gates Hotel - Bomet'
    };

    console.log('📧 Sending test booking confirmation email...');
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
      console.log('✅ Email sent successfully!');
      console.log('   Response:', response.data);
      console.log();
      console.log('📬 Check the inbox for:', testBookingDetails.email);
      console.log('   Subject: Booking Confirmation - Famous Gates Hotel - Bomet');
      console.log();
      console.log('✅ Test completed successfully!');
    } else {
      console.error('❌ Unexpected response status:', response.status);
      console.error('   Response:', response.data);
    }

  } catch (error) {
    console.error('❌ Error testing email:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting landing page email test...\n');
testLandingEmail()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
