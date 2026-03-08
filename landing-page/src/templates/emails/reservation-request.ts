/**
 * Generates the HTML string for a Reservation Request email.
 * This is meant for reservations that are pending payment, asking the user to complete their booking.
 */
export const getReservationRequestEmailHtml = (data: {
  guestName: string;
  reservationId: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  guests: number;
  totalAmount: number;
  paymentLink: string;
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
  <title>Reservation Request Pending</title>
  <style>
    body {
      font-family: 'Inter', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #fafafa;
      color: #334155;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      border: 1px solid #f1f5f9;
    }
    .header {
      background-color: #f8fafc;
      padding: 40px 30px;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    .badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #b45309;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #0f172a;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      font-weight: 500;
      color: #1e293b;
    }
    .summary-card {
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 25px;
      margin-top: 30px;
      margin-bottom: 30px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    .row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .label {
      color: #64748b;
      font-size: 14px;
    }
    .value {
      font-weight: 600;
      color: #0f172a;
      font-size: 15px;
      text-align: right;
    }
    .total-row {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px dashed #cbd5e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 16px;
      font-weight: 600;
      color: #334155;
    }
    .total-value {
      font-size: 24px;
      font-weight: 700;
      color: #2563eb;
    }
    .action-container {
      text-align: center;
      margin-top: 40px;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: white !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #1d4ed8;
    }
    .notice {
      text-align: center;
      font-size: 13px;
      color: #94a3b8;
      margin-top: 15px;
    }
    .footer {
      text-align: center;
      padding: 30px;
      font-size: 13px;
      color: #64748b;
      background-color: #ffffff;
      border-top: 1px solid #f1f5f9;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 15px;
      }
      .row {
        flex-direction: column;
      }
      .value {
        text-align: left;
        margin-top: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 70px; margin-bottom: 20px;">
      <div class="badge">Action Required</div>
      <h1>Complete Your Reservation</h1>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${data.guestName},</div>
      <p style="line-height: 1.6;">
        We have received your reservation request for <strong>${data.hotelName}</strong>. To secure your room and finalize the booking, please complete your payment using the secure link below.
      </p>

      <div class="summary-card">
        <div class="row">
          <div class="label">Reservation ID</div>
          <div class="value">${data.reservationId}</div>
        </div>
        <div class="row">
          <div class="label">Dates</div>
          <div class="value">${data.checkInDate} &mdash; ${data.checkOutDate}</div>
        </div>
        <div class="row">
          <div class="label">Accommodations</div>
          <div class="value">${data.roomType}<br><span style="font-size: 13px; color: #64748b; font-weight: normal;">${data.guests} Guest${data.guests > 1 ? 's' : ''}</span></div>
        </div>
        <div class="total-row">
          <div class="total-label">Amount Due</div>
          <div class="total-value">KSH ${data.totalAmount.toLocaleString()}</div>
        </div>
      </div>

      <div class="action-container">
        <a href="${data.paymentLink}" class="btn">Proceed to Payment &rarr;</a>
        <div class="notice">
          This payment link will expire in 24 hours. Your room is not guaranteed until payment is received.
        </div>
      </div>
    </div>

    <div class="footer">
      <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">${data.hotelName}</div>
      <div>${data.hotelAddress}</div>
      <div style="margin-top: 10px;">
        Need help? Call <a href="tel:${data.hotelPhone.replace(/\\s+/g, '')}" style="color: #2563eb;">${data.hotelPhone}</a>
      </div>
    </div>
  </div>
</body>
</html>
`;
