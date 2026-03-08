/**
 * Resend Booking Confirmation Emails via Brevo API
 * 
 * This script fetches all bookings and resends confirmation emails using Brevo API
 */

const { createClient } = require('@supabase/supabase-js');
const { BrevoClient } = require('@getbrevo/brevo');
require('dotenv').config({ path: './.env' });

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Brevo client
const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const brevoClient = new BrevoClient({ apiKey });

const fromEmail = process.env.SMTP_FROM_EMAIL || 'info@famousgatehotels.com';
const fromName = process.env.SMTP_FROM_NAME || 'FamousGate Hotels';

function createEmailHTML(booking) {
  const guestName = booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Guest';
  const guestEmail = booking.guest ? booking.guest.email : booking.guest_email;
  const guestPhone = booking.guest ? booking.guest.phone : booking.guest_phone || 'N/A';
  
  // Calculate total guests
  const adults = booking.adults || 0;
  const children = booking.children || 0;
  const infants = booking.infants || 0;
  const totalGuests = adults + children + infants;
  const guestBreakdown = [];
  if (adults > 0) guestBreakdown.push(`${adults} adult${adults > 1 ? 's' : ''}`);
  if (children > 0) guestBreakdown.push(`${children} child${children > 1 ? 'ren' : ''}`);
  if (infants > 0) guestBreakdown.push(`${infants} infant${infants > 1 ? 's' : ''}`);
  const guestText = guestBreakdown.length > 0 ? guestBreakdown.join(', ') : `${totalGuests} guest(s)`;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  // Generate barcode URL
  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${booking.confirmation_number}&code=Code128&translate-esc=on&dpi=96&imagetype=Gif`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
          font-family: 'Georgia', 'Times New Roman', serif;
          background: #f8f8f8;
          color: #333333;
          line-height: 1.8;
          padding: 20px;
        }
        
        .document-wrapper {
          max-width: 650px;
          margin: 0 auto;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
          background: #ffffff;
          padding: 40px 50px 30px;
          border-bottom: 3px solid #d4af37;
        }
        
        .logo-section {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          margin-right: 15px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #1a1a1a;
          letter-spacing: 1px;
        }
        
        .contact-info {
          font-size: 12px;
          color: #666666;
          line-height: 1.6;
        }
        
        .contact-info a {
          color: #d4af37;
          text-decoration: none;
        }
        
        .document-title {
          text-align: center;
          padding: 30px 50px 20px;
          background: #fafafa;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .document-title h1 {
          font-size: 22px;
          font-weight: normal;
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        
        .document-date {
          font-size: 13px;
          color: #666666;
        }
        
        .content {
          padding: 40px 50px;
        }
        
        .subject-line {
          font-size: 14px;
          color: #666666;
          margin-bottom: 10px;
        }
        
        .subject-text {
          font-weight: bold;
          color: #1a1a1a;
        }
        
        .greeting {
          font-size: 15px;
          color: #1a1a1a;
          margin: 30px 0 20px;
        }
        
        .intro-text {
          font-size: 14px;
          color: #333333;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #1a1a1a;
          margin: 30px 0 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #d4af37;
        }
        
        .detail-list {
          list-style: none;
          padding: 0;
          margin: 0 0 25px 0;
        }
        
        .detail-list li {
          font-size: 14px;
          color: #333333;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .detail-list li:last-child {
          border-bottom: none;
        }
        
        .detail-label {
          display: inline-block;
          width: 180px;
          color: #666666;
        }
        
        .detail-value {
          color: #1a1a1a;
          font-weight: 500;
        }
        
        .barcode-section {
          text-align: center;
          padding: 25px;
          background: #fafafa;
          border: 1px solid #e0e0e0;
          margin: 25px 0;
        }
        
        .barcode-label {
          font-size: 12px;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        
        .barcode-number {
          font-size: 20px;
          font-weight: bold;
          color: #1a1a1a;
          font-family: 'Courier New', monospace;
          margin-bottom: 15px;
        }
        
        .barcode img {
          max-width: 300px;
          height: auto;
        }
        
        .amount-section {
          background: #f9f6f0;
          border: 2px solid #d4af37;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        
        .amount-label {
          font-size: 14px;
          color: #666666;
          margin-bottom: 8px;
        }
        
        .amount-value {
          font-size: 28px;
          font-weight: bold;
          color: #1a1a1a;
        }
        
        .info-box {
          background: #f0f8ff;
          border-left: 4px solid #4a90e2;
          padding: 20px;
          margin: 25px 0;
        }
        
        .info-box-title {
          font-size: 14px;
          font-weight: bold;
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        
        .info-box-text {
          font-size: 13px;
          color: #333333;
          line-height: 1.7;
        }
        
        .closing-text {
          font-size: 14px;
          color: #333333;
          margin: 30px 0;
          line-height: 1.8;
        }
        
        .signature {
          margin-top: 40px;
          font-size: 14px;
          color: #333333;
        }
        
        .footer {
          background: #1a1a1a;
          color: #ffffff;
          padding: 30px 50px;
          text-align: center;
          font-size: 12px;
          line-height: 1.6;
        }
        
        .footer-logo {
          width: 40px;
          height: 40px;
          margin: 0 auto 15px;
          display: block;
          filter: brightness(0) invert(1);
        }
        
        .footer-company {
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .footer-text {
          color: #cccccc;
          margin: 5px 0;
        }
        
        .footer-link {
          color: #d4af37;
          text-decoration: none;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
          body {
            padding: 10px;
          }
          
          .header,
          .document-title,
          .content,
          .footer {
            padding-left: 25px;
            padding-right: 25px;
          }
          
          .logo-section {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .logo {
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 20px;
          }
          
          .document-title h1 {
            font-size: 18px;
          }
          
          .detail-label {
            display: block;
            width: 100%;
            margin-bottom: 5px;
            font-weight: bold;
          }
          
          .detail-value {
            display: block;
            padding-left: 0;
          }
          
          .amount-value {
            font-size: 24px;
          }
          
          .barcode img {
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="document-wrapper">
        <!-- Header with Logo and Contact Info -->
        <div class="header">
          <div class="logo-section">
            <img src="https://i.ibb.co/S45vFwsd/fglogoo.png" alt="FG" class="logo" />
            <div class="company-name">FAMOUSGATE HOTELS</div>
          </div>
          <div class="contact-info">
            P.O. Box 123, Bomet, Kenya<br>
            <a href="mailto:info@famousgatehotels.com">info@famousgatehotels.com</a> | 
            <a href="tel:+254706782828">+254 706 782 828</a> | 
            www.famousgatehotels.com
          </div>
        </div>
        
        <!-- Document Title -->
        <div class="document-title">
          <h1>Hotel Booking Confirmation Email</h1>
          <div class="document-date">${today}</div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
          <div class="subject-line">
            <strong>Subject:</strong> <span class="subject-text">Booking Confirmation - ${booking.confirmation_number}</span>
          </div>
          
          <div class="greeting">Dear ${guestName},</div>
          
          <div class="intro-text">
            Thank you for choosing FamousGate Hotels. We are pleased to confirm your reservation. 
            This email serves as your official booking confirmation. Please review the details below 
            and contact us if you have any questions.
          </div>
          
          <!-- Barcode Section -->
          <div class="barcode-section">
            <div class="barcode-label">Confirmation Number</div>
            <div class="barcode-number">${booking.confirmation_number}</div>
            <div class="barcode">
              <img src="${barcodeUrl}" alt="Confirmation Barcode" />
            </div>
          </div>
          
          <!-- Reservation Details -->
          <div class="section-title">Reservation Details</div>
          <ul class="detail-list">
            <li><span class="detail-label">Guest Name:</span> <span class="detail-value">${guestName}</span></li>
            <li><span class="detail-label">Email Address:</span> <span class="detail-value">${guestEmail}</span></li>
            <li><span class="detail-label">Phone Number:</span> <span class="detail-value">${guestPhone}</span></li>
            <li><span class="detail-label">Number of Guests:</span> <span class="detail-value">${guestText}</span></li>
            <li><span class="detail-label">Check-in Date:</span> <span class="detail-value">${new Date(booking.check_in_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></li>
            <li><span class="detail-label">Check-out Date:</span> <span class="detail-value">${new Date(booking.check_out_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></li>
          </ul>
          
          <!-- Amount -->
          <div class="amount-section">
            <div class="amount-label">Total Amount</div>
            <div class="amount-value">KES ${parseFloat(booking.total_amount).toLocaleString()}</div>
          </div>
          
          <!-- Check-in Information -->
          <div class="section-title">Check-in Information</div>
          <ul class="detail-list">
            <li><span class="detail-label">Check-in Time:</span> <span class="detail-value">From 2:00 PM</span></li>
            <li><span class="detail-label">Check-out Time:</span> <span class="detail-value">Before 11:00 AM</span></li>
            <li><span class="detail-label">Required at Check-in:</span> <span class="detail-value">Valid ID and confirmation number</span></li>
            <li><span class="detail-label">Early Check-in:</span> <span class="detail-value">Available upon request (subject to availability)</span></li>
          </ul>
          
          <!-- Hotel Amenities -->
          <div class="section-title">Hotel Amenities</div>
          <ul class="detail-list">
            <li>• Complimentary Wi-Fi throughout the property</li>
            <li>• 24-hour front desk service</li>
            <li>• On-site restaurant and bar</li>
            <li>• Secure parking facilities</li>
            <li>• Room service available</li>
          </ul>
          
          <!-- Important Notice -->
          <div class="info-box">
            <div class="info-box-title">Important Notice</div>
            <div class="info-box-text">
              A detailed PDF invoice has been attached to this email for your records. 
              Please present your confirmation number upon arrival. For any changes or 
              cancellations, please contact us at least 24 hours in advance.
            </div>
          </div>
          
          <div class="closing-text">
            We look forward to welcoming you to FamousGate Hotels. Should you require any 
            special arrangements or have questions about your reservation, please do not 
            hesitate to contact us.
          </div>
          
          <div class="signature">
            Warm regards,<br>
            <strong>FamousGate Hotels Team</strong>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <img src="https://i.ibb.co/S45vFwsd/fglogoo.png" alt="FG" class="footer-logo" />
          <div class="footer-company">FAMOUSGATE HOTELS</div>
          <div class="footer-text">P.O. Box 123, Bomet, Kenya</div>
          <div class="footer-text">
            <a href="tel:+254706782828" class="footer-link">+254 706 782 828</a> • 
            <a href="mailto:info@famousgatehotels.com" class="footer-link">info@famousgatehotels.com</a>
          </div>
          <div class="footer-text" style="margin-top: 15px; font-size: 11px; color: #999999;">
            © ${new Date().getFullYear()} FamousGate Hotels. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function resendBookingEmails() {
  try {
    console.log('🔍 Fetching all bookings from the database...\n');

    // Fetch all bookings
    const { data: bookings, error } = await supabase
      .from('reservations')
      .select('*, guest:guests!guest_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    if (!bookings || bookings.length === 0) {
      console.log('❌ No bookings found in the database.');
      return;
    }

    console.log(`✓ Found ${bookings.length} booking(s) in total:\n`);

    let successCount = 0;
    let failCount = 0;

    for (const booking of bookings) {
      const guestName = booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Guest';
      const guestEmail = booking.guest ? booking.guest.email : booking.guest_email;
      
      console.log(`📧 Processing booking: ${booking.confirmation_number}`);
      console.log(`   Guest: ${guestName} (${guestEmail})`);
      console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);

      // Send email via Brevo API
      console.log(`   Sending confirmation email via Brevo API...`);
      
      const emailData = {
        sender: {
          name: fromName,
          email: fromEmail
        },
        to: [{
          email: guestEmail,
          name: guestName
        }],
        subject: `Booking Confirmation - ${booking.confirmation_number} - FamousGate Hotels`,
        htmlContent: createEmailHTML(booking)
      };

      try {
        const result = await brevoClient.transactionalEmails.sendTransacEmail(emailData);
        console.log(`   ✓ Email sent successfully to ${guestEmail}`);
        console.log(`   Message ID: ${result.messageId}\n`);
        successCount++;
      } catch (emailError) {
        console.error(`   ✗ Failed to send email: ${emailError.message}\n`);
        failCount++;
      }
    }

    console.log('✅ Email resend process completed!');
    console.log('\n📝 Summary:');
    console.log(`   Total bookings processed: ${bookings.length}`);
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n📬 Emails sent to:');
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
console.log('🚀 Starting email resend process via Brevo API...\n');
resendBookingEmails()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
