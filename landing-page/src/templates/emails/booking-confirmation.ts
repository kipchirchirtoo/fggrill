/**
 * Generates the HTML string for a Booking Confirmation email.
 * This matches the Reference Design 1 (Blue/Gold accents, clear check-in/out dates, and hotel details).
 */
export const getBookingConfirmationEmailHtml = (data: {
  guestName: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  guests: number;
  totalAmount: number;
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelEmail: string;
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f7f6;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }
    .header {
      background-color: #1a365d; /* Deep Blue */
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 300;
      letter-spacing: 1px;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 16px;
      color: #cbd5e0;
    }
    .gold-separator {
      height: 4px;
      background-color: #d4af37; /* Gold */
      width: 100%;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 20px;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .conf-number-box {
      background-color: #f8fafc;
      border-left: 4px solid #d4af37;
      padding: 20px;
      margin-bottom: 30px;
    }
    .conf-number-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .conf-number-value {
      font-size: 24px;
      font-weight: 700;
      color: #1a365d;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 30px;
    }
    .detail-item {
      margin-bottom: 15px;
    }
    .detail-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .detail-value {
      font-size: 16px;
      font-weight: 500;
    }
    .amount-box {
      background-color: #1a365d;
      color: white;
      padding: 20px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }
    .amount-label {
      font-size: 14px;
    }
    .amount-value {
      font-size: 24px;
      font-weight: 700;
      color: #d4af37;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #64748b;
    }
    .footer strong {
      color: #333333;
    }
    .contact-info {
      margin-top: 15px;
    }
    .contact-info a {
      color: #1a365d;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .details-grid {
        grid-template-columns: 1fr;
      }
      .email-container {
        margin: 20px 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 80px; margin-bottom: 20px;">
      <h1>Booking Confirmed</h1>
      <p>We're looking forward to your stay</p>
    </div>
    <div class="gold-separator"></div>
    
    <div class="content">
      <div class="greeting">Dear ${data.guestName},</div>
      <p style="color: #475569; line-height: 1.6; margin-bottom: 30px;">
        Thank you for choosing ${data.hotelName}. Your reservation is confirmed and we are thrilled to host you. Please find your booking details below.
      </p>

      <div class="conf-number-box">
        <div class="conf-number-label">Confirmation Number</div>
        <div class="conf-number-value">${data.confirmationNumber}</div>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Check-In</div>
          <div class="detail-value">${data.checkInDate}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">From 2:00 PM</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Check-Out</div>
          <div class="detail-value">${data.checkOutDate}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Until 11:00 AM</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Room Type</div>
          <div class="detail-value">${data.roomType}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Guests</div>
          <div class="detail-value">${data.guests} Guest${data.guests > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Total Amount Paid</div>
        <div class="amount-value">KSH ${data.totalAmount.toLocaleString()}</div>
      </div>

      <p style="color: #475569; line-height: 1.6; font-size: 15px;">
        A detailed invoice in PDF format has been attached to this email for your records. If you have any special requests or require airport transfers, please don't hesitate to contact us.
      </p>
    </div>

    <div class="footer">
      <div><strong>${data.hotelName}</strong></div>
      <div style="margin-top: 5px;">${data.hotelAddress}</div>
      <div class="contact-info">
        <a href="tel:${data.hotelPhone.replace(/\\s+/g, '')}">${data.hotelPhone}</a> &nbsp;|&nbsp; 
        <a href="mailto:${data.hotelEmail}">${data.hotelEmail}</a>
      </div>
      <div style="margin-top: 25px; font-size: 12px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} ${data.hotelName}. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
`;
