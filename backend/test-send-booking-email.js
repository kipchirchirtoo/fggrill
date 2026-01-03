// Test script to resend booking confirmation email with barcode
require('dotenv').config();
const { emailService } = require('./dist/services/email.service');

const bookingDetails = {
  id: 'c7e783ee-7bf0-4040-941d-cac9d9188780',
  confirmation_number: 'HTL251216-0011',
  guest_name: 'KIPCHIRCHIR ALLANSAMWEL TOO',
  first_name: 'KIPCHIRCHIR ALLANSAMWEL',
  last_name: 'TOO',
  email: 'kipchirchirtoo01@gmail.com',
  check_in_date: '2025-12-16',
  check_out_date: '2025-12-17',
  total_amount: 6930.00,
  status: 'confirmed',
  adults: 1,
  children: 0
};

async function sendEmail() {
  try {
    console.log('Sending booking confirmation email with barcode...');
    console.log('Booking:', bookingDetails.confirmation_number);
    console.log('To:', bookingDetails.email);
    
    await emailService.sendBookingConfirmation(
      bookingDetails.email,
      bookingDetails
    );
    
    console.log('✓ Email sent successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error sending email:', error.message);
    console.error(error);
    process.exit(1);
  }
}

sendEmail();
