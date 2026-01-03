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
        console.log(`✓ Barcode generated successfully for ${booking.confirmation_number}`);
      }

      // Use enterprise template
      const { enterpriseEmailTemplates } = require('./dist/utils/emailTemplates.enterprise');
      const emailHtml = enterpriseEmailTemplates.bookingConfirmation({
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
      }, barcodeBase64);

      // Send email with enterprise template
      await transporter.sendMail({
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to: guest.email,
        subject: 'Booking Confirmation - Famous Gate Hotel',
        html: emailHtml
      });

      console.log(`✅ Email sent to ${guest.email} for booking ${booking.confirmation_number}`);
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

// OLD TEMPLATE CODE BELOW - NOT USED ANYMORE
const oldTemplateCode = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation - Famous Gate Hotel</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 650px; 
              margin: 20px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #2c3e50 0%, #3c3c43 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 32px;
              font-weight: 600;
              letter-spacing: 1px;
            }
            .header p {
              margin: 0;
              font-size: 16px;
              opacity: 0.9;
            }
            .content { 
              padding: 40px 30px; 
              background: #ffffff; 
            }
            .greeting {
              font-size: 18px;
              color: #2c3e50;
              margin-bottom: 20px;
            }
            .confirmation-box {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 25px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
              color: white;
            }
            .confirmation-box h2 {
              margin: 0 0 10px 0;
              font-size: 16px;
              font-weight: 400;
              opacity: 0.9;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .confirmation-number {
              font-size: 28px;
              font-weight: 700;
              letter-spacing: 2px;
              margin: 0;
            }
            .booking-details { 
              background: #f8f9fa; 
              padding: 25px; 
              margin: 25px 0; 
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .booking-details h3 {
              margin: 0 0 20px 0;
              color: #2c3e50;
              font-size: 18px;
              font-weight: 600;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            td { 
              padding: 12px 8px; 
              border-bottom: 1px solid #e9ecef; 
            }
            td:first-child {
              font-weight: 600;
              color: #495057;
              width: 40%;
            }
            td:last-child {
              color: #212529;
            }
            .barcode-section {
              text-align: center;
              margin: 30px 0;
              padding: 25px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .barcode-section h3 {
              margin: 0 0 15px 0;
              color: #2c3e50;
              font-size: 16px;
              font-weight: 600;
            }
            .barcode-section p {
              margin: 10px 0 0 0;
              color: #6c757d;
              font-size: 14px;
            }
            .barcode-image {
              max-width: 100%;
              height: auto;
              margin: 15px 0;
              background: white;
              padding: 15px;
              border-radius: 5px;
              border: 2px dashed #dee2e6;
            }
            .info-box {
              background: #e7f3ff;
              border-left: 4px solid #0066cc;
              padding: 20px;
              margin: 25px 0;
              border-radius: 5px;
            }
            .info-box h4 {
              margin: 0 0 10px 0;
              color: #0066cc;
              font-size: 16px;
            }
            .info-box ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .info-box li {
              margin: 8px 0;
              color: #495057;
            }
            .footer { 
              background: #2c3e50;
              color: white;
              text-align: center; 
              padding: 30px; 
            }
            .footer p {
              margin: 5px 0;
              opacity: 0.9;
            }
            .footer a {
              color: #667eea;
              text-decoration: none;
            }
            .cta-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>FAMOUS GATE HOTEL</h1>
              <p>Your Booking is Confirmed</p>
            </div>
            
            <div class="content">
              <p class="greeting">Dear ${guest.first_name} ${guest.last_name},</p>
              
              <p>Thank you for choosing Famous Gate Hotel. We are delighted to confirm your reservation and look forward to welcoming you.</p>
              
              <div class="confirmation-box">
                <h2>Confirmation Number</h2>
                <p class="confirmation-number">${booking.confirmation_number}</p>
              </div>
              
              <div class="booking-details">
                <h3>Reservation Details</h3>
                <table>
                  <tr>
                    <td>Check-in Date</td>
                    <td>${new Date(booking.check_in_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td>Check-out Date</td>
                    <td>${new Date(booking.check_out_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td>Room Number</td>
                    <td>${room?.room_number || 'Will be assigned upon arrival'}</td>
                  </tr>
                  <tr>
                    <td>Room Type</td>
                    <td>${room?.room_type?.name || 'Standard Room'}</td>
                  </tr>
                  <tr>
                    <td>Number of Guests</td>
                    <td>${booking.adults} Adult${booking.adults > 1 ? 's' : ''}${booking.children ? `, ${booking.children} Child${booking.children > 1 ? 'ren' : ''}` : ''}</td>
                  </tr>
                  ${booking.meal_plan ? `<tr><td>Meal Plan</td><td>${booking.meal_plan}</td></tr>` : ''}
                  ${booking.special_requests ? `<tr><td>Special Requests</td><td>${booking.special_requests}</td></tr>` : ''}
                  <tr style="border-top: 2px solid #dee2e6;">
                    <td><strong>Total Amount</strong></td>
                    <td><strong>KES ${(booking.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  </tr>
                </table>
              </div>

              ${barcodeBase64 ? `
              <div class="barcode-section">
                <h3>Your Booking Barcode</h3>
                <img src="data:image/png;base64,${barcodeBase64}" alt="Booking Barcode" class="barcode-image" />
                <p>Please present this barcode at check-in for faster service</p>
              </div>
              ` : ''}

              <div class="info-box">
                <h4>Important Information</h4>
                <ul>
                  <li><strong>Check-in Time:</strong> 2:00 PM</li>
                  <li><strong>Check-out Time:</strong> 11:00 AM</li>
                  <li><strong>Cancellation Policy:</strong> Free cancellation up to 24 hours before check-in</li>
                  <li><strong>Payment:</strong> ${booking.deposit_paid ? 'Deposit paid' : 'Payment required at check-in'}</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #6c757d; margin-bottom: 15px;">Need to make changes to your reservation?</p>
                <a href="mailto:reservations@famousgatehotel.com" class="cta-button">Contact Us</a>
              </div>

              <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                If you have any questions or special requests, please don't hesitate to contact us at 
                <a href="mailto:reservations@famousgatehotel.com" style="color: #667eea;">reservations@famousgatehotel.com</a> 
                or call us at +254 XXX XXX XXX.
              </p>
            </div>
            
            <div class="footer">
              <p><strong>FAMOUS GATE HOTEL</strong></p>
              <p>Nairobi, Kenya</p>
              <p>Email: <a href="mailto:info@famousgatehotel.com">info@famousgatehotel.com</a></p>
              <p>Phone: +254 XXX XXX XXX</p>
              <p style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                © ${new Date().getFullYear()} Famous Gate Hotel. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to: guest.email,
        subject: 'Booking Confirmation - Famous Gate Hotel',
        html: emailHtml
      });

      console.log(`✅ Email sent to ${guest.email} for booking ${booking.confirmation_number}`);
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
