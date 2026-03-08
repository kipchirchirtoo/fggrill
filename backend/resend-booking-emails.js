/**
 * Resend Booking Confirmation Emails
 * 
 * This script fetches recent bookings and resends confirmation emails
 * to guests who made bookings today.
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer').default || require('nodemailer');
const fetch = require('node-fetch');
require('dotenv').config({ path: './.env' });

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Barcode service URL
const BARCODE_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

async function generateBarcode(bookingId) {
  try {
    const response = await fetch(`${BARCODE_SERVICE_URL}/api/barcode/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: bookingId,
        return_base64: true
      })
    });

    if (!response.ok) {
      throw new Error(`Barcode generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.barcode;
  } catch (error) {
    console.error(`Failed to generate barcode for ${bookingId}:`, error.message);
    return null;
  }
}

function createEmailHTML(booking, barcodeBase64) {
  const guestName = booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Guest';
  const guestEmail = booking.guest ? booking.guest.email : booking.guest_email;
  const guestPhone = booking.guest ? booking.guest.phone : booking.guest_phone || 'N/A';
  
  const barcodeImg = barcodeBase64 
    ? `<img src="data:image/png;base64,${barcodeBase64}" alt="Booking Barcode" style="max-width: 300px; margin: 20px 0;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #1a1a1a; }
        .value { color: #555; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #d4af37; color: #666; }
        .barcode-section { text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 32px;">Famous Gates Hotels</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Booking Confirmation</p>
        </div>
        
        <div class="content">
          <p>Dear ${guestName},</p>
          
          <p>Thank you for choosing Famous Gates Hotels! Your booking has been confirmed.</p>
          
          <div class="booking-details">
            <h2 style="color: #d4af37; margin-top: 0;">Booking Details</h2>
            
            <div class="detail-row">
              <span class="label">Confirmation Number:</span>
              <span class="value" style="font-size: 18px; color: #d4af37; font-weight: bold;">${booking.confirmation_number}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Guest Name:</span>
              <span class="value">${guestName}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Email:</span>
              <span class="value">${guestEmail}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Phone:</span>
              <span class="value">${guestPhone}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Check-in:</span>
              <span class="value">${new Date(booking.check_in_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Check-out:</span>
              <span class="value">${new Date(booking.check_out_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Number of Guests:</span>
              <span class="value">${booking.number_of_guests} guest(s)</span>
            </div>
            
            <div class="detail-row">
              <span class="label">Total Amount:</span>
              <span class="value" style="font-size: 20px; color: #d4af37; font-weight: bold;">KES ${parseFloat(booking.total_amount).toLocaleString()}</span>
            </div>
          </div>
          
          ${barcodeBase64 ? `
          <div class="barcode-section">
            <h3 style="color: #1a1a1a; margin-top: 0;">Your Booking Barcode</h3>
            <p style="color: #666; font-size: 14px;">Present this barcode at check-in</p>
            ${barcodeImg}
            <p style="color: #666; font-size: 12px; margin-top: 10px;">${booking.confirmation_number}</p>
          </div>
          ` : ''}
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>Important:</strong> Please arrive at the hotel between 2:00 PM and 11:00 PM on your check-in date. Early check-in may be available upon request.</p>
          </div>
          
          <p>If you have any questions or need to modify your booking, please contact us:</p>
          <ul>
            <li>Email: info@famousgatehotels.com</li>
            <li>Phone: +254 XXX XXX XXX</li>
          </ul>
          
          <p>We look forward to welcoming you!</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>Famous Gates Hotels Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 5px 0;">Famous Gates Hotels</p>
          <p style="margin: 5px 0; font-size: 12px;">This is an automated confirmation email. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function resendBookingEmails() {
  try {
    console.log('🔍 Fetching recent bookings from the last 7 days...\n');

    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    // Fetch bookings created in the last 7 days
    const { data: bookings, error } = await supabase
      .from('reservations')
      .select('*, guest:guests!guest_id(*)')
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    if (!bookings || bookings.length === 0) {
      console.log('❌ No bookings found in the last 7 days.');
      return;
    }

    console.log(`✓ Found ${bookings.length} booking(s) from the last 7 days:\n`);

    for (const booking of bookings) {
      const guestName = booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Guest';
      const guestEmail = booking.guest ? booking.guest.email : booking.guest_email;
      
      console.log(`📧 Processing booking: ${booking.confirmation_number}`);
      console.log(`   Guest: ${guestName} (${guestEmail})`);
      console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);

      // Generate barcode
      console.log(`   Generating barcode...`);
      const barcodeBase64 = await generateBarcode(booking.confirmation_number);
      
      if (barcodeBase64) {
        console.log(`   ✓ Barcode generated successfully`);
      } else {
        console.log(`   ⚠ Barcode generation failed, sending email without barcode`);
      }

      // Send email
      console.log(`   Sending confirmation email...`);
      
      const mailOptions = {
        from: `${process.env.SMTP_FROM_NAME || 'Famous Gates Hotels'} <${process.env.SMTP_FROM_EMAIL}>`,
        to: guestEmail,
        subject: `Booking Confirmation - ${booking.confirmation_number} - Famous Gates Hotels`,
        html: createEmailHTML(booking, barcodeBase64)
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`   ✓ Email sent successfully to ${guestEmail}\n`);
      } catch (emailError) {
        console.error(`   ✗ Failed to send email: ${emailError.message}\n`);
      }
    }

    console.log('✅ Email resend process completed!');
    console.log('\n📝 Summary:');
    console.log(`   Total bookings processed: ${bookings.length}`);
    console.log(`   Emails sent to:`);
    bookings.forEach(b => {
      const guestEmail = b.guest ? b.guest.email : b.guest_email;
      console.log(`   - ${guestEmail} (${b.confirmation_number})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
console.log('🚀 Starting email resend process...\n');
resendBookingEmails()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
