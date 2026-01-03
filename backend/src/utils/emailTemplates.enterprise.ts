/**
 * Enterprise-grade email templates
 * Minimal, professional design inspired by Booking.com, Airbnb, Expedia
 * Clean UI/UX with light theme, no emojis, professional color scheme
 */

export const enterpriseEmailTemplates = {
  bookingConfirmation: (bookingDetails: any, barcodeBase64?: string) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="format-detection" content="telephone=no">
      <title>Booking Confirmation</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #2b2b2b;
          background-color: #f5f5f5;
          padding: 0;
          margin: 0;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          width: 100% !important;
        }
        .mobile-padding { padding: 0 !important; }
        .header {
          background-color: #ffffff;
          padding: 32px 24px;
          border-bottom: 1px solid #e0e0e0;
        }
        .logo {
          font-size: 24px;
          font-weight: 600;
          color: #2b2b2b;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 32px 24px;
        }
        .confirmation-badge {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 24px 0;
        }
        .confirmation-badge h2 {
          font-size: 14px;
          font-weight: 500;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .confirmation-number {
          font-size: 28px;
          font-weight: 700;
          color: #0c4a6e;
          letter-spacing: 1px;
        }
        .section {
          margin: 32px 0;
          padding: 24px;
          background-color: #fafafa;
          border-radius: 8px;
          border: 1px solid #e5e5e5;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #2b2b2b;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;
        }
        .detail-row {
          display: table;
          width: 100%;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          display: table-cell;
          width: 40%;
          font-size: 14px;
          color: #666666;
          vertical-align: top;
        }
        .detail-value {
          display: table-cell;
          font-size: 14px;
          color: #2b2b2b;
          font-weight: 500;
          vertical-align: top;
        }
        .total-row {
          background-color: #ffffff;
          padding: 16px;
          margin-top: 12px;
          border-radius: 6px;
          border: 2px solid #e0e0e0;
        }
        .total-row .detail-label,
        .total-row .detail-value {
          font-size: 16px;
          font-weight: 700;
          color: #2b2b2b;
        }
        .barcode-section {
          text-align: center;
          padding: 24px 16px;
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin: 24px 0;
        }
        .barcode-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #2b2b2b;
          margin-bottom: 16px;
        }
        .barcode-image {
          max-width: 350px;
          width: 100%;
          height: auto;
          display: block;
          margin: 16px auto;
          padding: 12px;
          background-color: #ffffff;
          border: 2px dashed #d0d0d0;
          border-radius: 6px;
        }
        .barcode-instruction {
          font-size: 13px;
          color: #666666;
          margin-top: 12px;
          line-height: 1.5;
        }
        .info-box {
          background-color: #fffbeb;
          border-left: 4px solid #fbbf24;
          padding: 16px;
          margin: 24px 0;
          border-radius: 4px;
        }
        .info-box-title {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
        }
        .info-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
        }
        .info-list li {
          padding: 6px 0;
          font-size: 13px;
          color: #78350f;
          line-height: 1.5;
        }
        .info-list li strong {
          color: #92400e;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2b2b2b;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          margin: 8px 4px;
        }
        .button-secondary {
          background-color: #ffffff;
          color: #2b2b2b;
          border: 1px solid #d0d0d0;
        }
        .footer {
          background-color: #fafafa;
          padding: 32px 24px;
          text-align: center;
          border-top: 1px solid #e0e0e0;
        }
        .footer-text {
          font-size: 13px;
          color: #666666;
          line-height: 1.8;
        }
        .footer-links {
          margin-top: 16px;
        }
        .footer-link {
          color: #0369a1;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper { width: 100% !important; min-width: 100% !important; }
          .header { padding: 20px 16px !important; }
          .logo { font-size: 18px !important; }
          .content { padding: 20px 16px !important; }
          .section { padding: 16px !important; margin: 16px 0 !important; }
          .section-title { font-size: 14px !important; }
          .detail-label, .detail-value { display: block !important; width: 100% !important; font-size: 13px !important; }
          .detail-label { margin-bottom: 4px !important; }
          .confirmation-badge { padding: 16px !important; margin: 16px 0 !important; }
          .confirmation-number { font-size: 20px !important; letter-spacing: 1px !important; }
          .barcode-section { padding: 16px 12px !important; margin: 16px 0 !important; }
          .barcode-image { max-width: 100% !important; width: 100% !important; padding: 8px !important; }
          .button { display: block !important; width: 100% !important; margin: 8px 0 !important; padding: 14px 20px !important; box-sizing: border-box !important; }
          .footer { padding: 20px 16px !important; }
          .info-box { padding: 12px !important; margin: 16px 0 !important; }
          .detail-row { padding: 10px 0 !important; }
        }
        @media only screen and (max-width: 480px) {
          .logo { font-size: 16px !important; }
          .confirmation-number { font-size: 18px !important; }
          .section-title { font-size: 13px !important; }
          .detail-label, .detail-value { font-size: 12px !important; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Header -->
        <div class="header">
          <div class="logo">Famous Gate Hotel</div>
        </div>

        <!-- Content -->
        <div class="content">
          <p style="font-size: 16px; margin-bottom: 24px;">Dear ${bookingDetails.guest_name || 'Guest'},</p>
          
          <p style="font-size: 14px; color: #666666; margin-bottom: 24px;">
            Thank you for your reservation. Your booking has been confirmed and we look forward to welcoming you.
          </p>

          <!-- Confirmation Badge -->
          <div class="confirmation-badge">
            <h2>Confirmation Number</h2>
            <div class="confirmation-number">${bookingDetails.confirmation_number || bookingDetails.id}</div>
          </div>

          <!-- Reservation Details -->
          <div class="section">
            <div class="section-title">Reservation Details</div>
            
            <div class="detail-row">
              <div class="detail-label">Check-in</div>
              <div class="detail-value">${new Date(bookingDetails.check_in).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} from 2:00 PM</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Check-out</div>
              <div class="detail-value">${new Date(bookingDetails.check_out).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} by 11:00 AM</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${Math.ceil((new Date(bookingDetails.check_out).getTime() - new Date(bookingDetails.check_in).getTime()) / (1000 * 60 * 60 * 24))} night${Math.ceil((new Date(bookingDetails.check_out).getTime() - new Date(bookingDetails.check_in).getTime()) / (1000 * 60 * 60 * 24)) > 1 ? 's' : ''}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Room Type</div>
              <div class="detail-value">${bookingDetails.room_type || 'Standard Room'}</div>
            </div>
            
            ${bookingDetails.room_number ? `
            <div class="detail-row">
              <div class="detail-label">Room Number</div>
              <div class="detail-value">${bookingDetails.room_number}</div>
            </div>
            ` : ''}
            
            <div class="detail-row">
              <div class="detail-label">Guests</div>
              <div class="detail-value">${bookingDetails.adults} Adult${bookingDetails.adults > 1 ? 's' : ''}${bookingDetails.children ? `, ${bookingDetails.children} Child${bookingDetails.children > 1 ? 'ren' : ''}` : ''}</div>
            </div>
          </div>

          <!-- Price Breakdown -->
          <div class="section">
            <div class="section-title">Price Summary</div>
            
            <div class="detail-row">
              <div class="detail-label">Room rate</div>
              <div class="detail-value">KES ${(bookingDetails.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Taxes & fees</div>
              <div class="detail-value">KES ${((bookingDetails.tax_amount || 0) + (bookingDetails.service_charge || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            
            <div class="total-row">
              <div class="detail-row">
                <div class="detail-label">Total</div>
                <div class="detail-value">KES ${(bookingDetails.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
            
            <div class="detail-row" style="margin-top: 12px;">
              <div class="detail-label">Payment status</div>
              <div class="detail-value" style="color: #059669;">${bookingDetails.deposit_paid ? 'Paid' : 'Payment required at check-in'}</div>
            </div>
          </div>

          ${barcodeBase64 ? `
          <!-- Barcode -->
          <div class="barcode-section">
            <h3>Your Booking Barcode</h3>
            <img src="cid:barcode@famousgatehotel" alt="Booking Barcode" class="barcode-image" />
            <p class="barcode-instruction">Present this barcode at check-in for faster service</p>
            <p style="font-size: 12px; color: #999999; margin-top: 8px;">
              <strong>How it works:</strong> This barcode contains your booking confirmation number (${bookingDetails.confirmation_number}). 
              When scanned at check-in, it instantly retrieves your reservation details, verifies your booking, 
              and speeds up the check-in process.
            </p>
          </div>
          ` : ''}

          <!-- Important Information -->
          <div class="info-box">
            <div class="info-box-title">Important Information</div>
            <ul class="info-list">
              <li><strong>Check-in:</strong> 2:00 PM - 11:00 PM</li>
              <li><strong>Check-out:</strong> 11:00 AM</li>
              <li><strong>Cancellation:</strong> Free cancellation up to 24 hours before arrival</li>
              <li><strong>ID Required:</strong> Valid government-issued photo ID and credit card</li>
            </ul>
          </div>

          ${bookingDetails.special_requests ? `
          <div class="section">
            <div class="section-title">Special Requests</div>
            <p style="font-size: 14px; color: #666666; line-height: 1.6;">
              ${bookingDetails.special_requests}
            </p>
            <p style="font-size: 12px; color: #999999; margin-top: 8px;">
              Special requests cannot be guaranteed and are subject to availability upon arrival.
            </p>
          </div>
          ` : ''}

          <!-- Actions -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="mailto:reservations@famousgatehotel.com" class="button">Contact Hotel</a>
            <a href="#" class="button button-secondary">View Booking</a>
          </div>

          <p style="font-size: 13px; color: #666666; text-align: center; margin-top: 24px;">
            Questions? Contact us at <a href="mailto:reservations@famousgatehotel.com" style="color: #0369a1; text-decoration: none;">reservations@famousgatehotel.com</a> or +254 XXX XXX XXX
          </p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-text">
            <strong>Famous Gate Hotel</strong><br>
            123 Hotel Street, Nairobi, Kenya<br>
            +254 XXX XXX XXX
          </div>
          <div class="footer-links">
            <a href="#" class="footer-link">Privacy Policy</a>
            <a href="#" class="footer-link">Terms of Service</a>
            <a href="#" class="footer-link">Contact Us</a>
          </div>
          <p style="font-size: 12px; color: #999999; margin-top: 16px;">
            © ${new Date().getFullYear()} Famous Gate Hotel. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
};
