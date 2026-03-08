/**
 * Send One Test Email with PDF Attachment
 * 
 * This script sends a single test booking confirmation email with PDF invoice
 */

const axios = require('axios');
require('dotenv').config({ path: './.env' });

// Test booking data
const testBooking = {
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

async function sendTestEmail() {
  console.log('📧 Sending Test Email with PDF Attachment\n');
  console.log('=' .repeat(60));
  console.log('\n📋 Test Booking Details:');
  console.log(`   Guest: ${testBooking.firstName} ${testBooking.lastName}`);
  console.log(`   Email: ${testBooking.email}`);
  console.log(`   Confirmation: ${testBooking.confirmationNumber}`);
  console.log(`   Check-in: ${testBooking.checkInDate}`);
  console.log(`   Check-out: ${testBooking.checkOutDate}`);
  console.log(`   Room: ${testBooking.roomType}`);
  console.log(`   Guests: ${testBooking.guests}`);
  console.log(`   Amount: KES ${testBooking.totalAmount.toLocaleString()}`);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    console.log('🚀 Sending email via backend API...\n');
    
    const response = await axios.post(
      'http://localhost:5000/api/landing-email/confirmation',
      testBooking,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS! Email sent successfully!\n');
    console.log('Response:', response.data);
    console.log('\n' + '='.repeat(60));
    console.log('\n📬 Check your inbox:');
    console.log(`   Email: ${testBooking.email}`);
    console.log(`   Subject: Booking Confirmation - ${testBooking.confirmationNumber}`);
    console.log('\n✓ What to verify:');
    console.log('   1. Email received with professional document design');
    console.log('   2. Phone number shows: +254 706 782 828');
    console.log('   3. PDF invoice is attached');
    console.log('   4. PDF opens and shows all booking details');
    console.log('   5. All information is correct');
    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR sending email!\n');
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    } else if (error.request) {
      console.error('No response from server. Is the backend running?');
      console.error('Make sure backend is running on http://localhost:5000');
    } else {
      console.error('Error:', error.message);
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure backend is running: cd backend && npm run dev');
    console.log('   2. Make sure Python service is running: cd python-services && python barcode_app.py');
    console.log('   3. Check .env file has BREVO_API_KEY configured');
    console.log('   4. Verify sender email is verified in Brevo dashboard');
    
    process.exit(1);
  }
}

// Email is configured - ready to send!

// Run the test
sendTestEmail();
