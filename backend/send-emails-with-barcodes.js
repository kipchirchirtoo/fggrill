const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function generateBarcode(bookingId) {
  try {
    const response = await fetch('http://localhost:5001/api/barcode/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: bookingId,
        format: 'code128',
        include_text: true,
        return_base64: true
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.barcode;
    }
  } catch (error) {
    console.error('Barcode generation failed:', error.message);
  }
  return null;
}

async function sendBookingEmails() {
  console.log('Fetching confirmed bookings...');
  
  const { data: bookings, error } = await supabase
    .from('reservations')
    .select(`
      *,
      guest:guests(*),
      room:rooms(room_number, room_type:room_types!rooms_type_id_fkey(name))
    `)
    .in('status', ['confirmed', 'checked_in']);

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`Found ${bookings?.length || 0} bookings`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Load enterprise template
  const { enterpriseEmailTemplates } = require('./dist/utils/emailTemplates.enterprise');

  for (const booking of bookings || []) {
    try {
      const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
      const room = Array.isArray(booking.room) ? booking.room[0] : booking.room;

      if (!guest || !guest.email) {
        console.log(`Skipping booking ${booking.confirmation_number} - no guest email`);
        failed++;
        continue;
      }

      // Skip mock/test emails
      if (guest.email.includes('example.com') || guest.email.includes('test.com')) {
        console.log(`Skipping mock email: ${guest.email}`);
        skipped++;
        continue;
      }

      // Generate barcode
      console.log(`Generating barcode for ${booking.confirmation_number}...`);
      const barcodeBase64 = await generateBarcode(booking.confirmation_number);
      
      if (!barcodeBase64) {
        console.warn(`⚠️  Barcode generation failed for ${booking.confirmation_number}`);
      } else {
        console.log(`✓ Barcode generated successfully`);
      }

      // Prepare booking details
      const bookingDetails = {
        confirmation_number: booking.confirmation_number,
        guest_name: `${guest.first_name} ${guest.last_name}`,
        check_in: booking.check_in_date,
        check_out: booking.check_out_date,
        room_number: room?.room_number,
        room_type: room?.room_type?.name,
        adults: booking.adults,
        children: booking.children,
        subtotal: booking.subtotal,
        tax_amount: booking.tax_amount,
        service_charge: booking.service_charge,
        total_amount: booking.total_amount,
        deposit_paid: booking.deposit_paid,
        payment_method: booking.payment_method,
        special_requests: booking.special_requests,
        meal_plan: booking.meal_plan
      };

      // Generate email HTML with barcode
      const emailHtml = enterpriseEmailTemplates.bookingConfirmation(bookingDetails, barcodeBase64);

      // Prepare email with barcode as CID attachment (more reliable than inline base64)
      const mailOptions = {
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to: guest.email,
        subject: 'Booking Confirmation - Famous Gate Hotel',
        html: emailHtml,
        attachments: barcodeBase64 ? [{
          filename: 'barcode.png',
          content: Buffer.from(barcodeBase64, 'base64'),
          cid: 'barcode@famousgatehotel',
          contentType: 'image/png'
        }] : []
      };

      // Send email
      await transporter.sendMail(mailOptions);

      console.log(`✅ Email ${barcodeBase64 ? 'WITH BARCODE' : 'WITHOUT BARCODE'} sent to ${guest.email} for booking ${booking.confirmation_number}`);
      sent++;
    } catch (error) {
      console.error(`❌ Failed to send email for booking ${booking.confirmation_number}:`, error.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total bookings: ${bookings?.length || 0}`);
  console.log(`   Emails sent: ${sent}`);
  console.log(`   Mock emails skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
  process.exit(0);
}

sendBookingEmails().catch(console.error);
