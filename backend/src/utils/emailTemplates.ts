export const emailTemplates = {
  // Booking confirmation template (Enhanced for complete booking journey)
  bookingConfirmation: (bookingDetails: any, barcodeBase64?: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3C3C43; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Famous Gates Hotels</h1>
          <h2>Booking Confirmation</h2>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
          <p>Thank you for choosing Famous Gates Hotels! Your booking has been confirmed.</p>
          
          <div class="booking-details">
            <h3>🎉 Booking Confirmed!</h3>
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
              <h2 style="color: #2d5a2d; margin: 0; font-size: 24px;">Booking ID: ${bookingDetails.confirmation_number || bookingDetails.id}</h2>
            </div>
            
            <h3>📋 Reservation Summary</h3>
            <table>
              <tr>
                <td class="highlight">Check-in Date & Time:</td>
                <td>${new Date(bookingDetails.check_in).toLocaleDateString()} - Check-in from 3:00 PM</td>
              </tr>
              <tr>
                <td class="highlight">Check-out Date & Time:</td>
                <td>${new Date(bookingDetails.check_out).toLocaleDateString()} - Check-out by 11:00 AM</td>
              </tr>
              <tr>
                <td class="highlight">Number of Nights:</td>
                <td>${Math.ceil((new Date(bookingDetails.check_out).getTime() - new Date(bookingDetails.check_in).getTime()) / (1000 * 60 * 60 * 24))} nights</td>
              </tr>
              <tr>
                <td class="highlight">Room Number:</td>
                <td>${bookingDetails.room_number || 'Will be assigned upon arrival'}</td>
              </tr>
              <tr>
                <td class="highlight">Room Type:</td>
                <td>${bookingDetails.room_type || 'Standard Room'}</td>
              </tr>
              <tr>
                <td class="highlight">Bed Configuration:</td>
                <td>King Size Bed (subject to availability)</td>
              </tr>
              <tr>
                <td class="highlight">Guests:</td>
                <td>${bookingDetails.adults} Adults${bookingDetails.children ? `, ${bookingDetails.children} Children` : ''}${bookingDetails.infants ? `, ${bookingDetails.infants} Infants` : ''}</td>
              </tr>
            </table>
          </div>

          <div class="booking-details">
            <h3>💰 Financial Breakdown</h3>
            <table>
              <tr>
                <td>Room Rate (per night):</td>
                <td>KES ${(bookingDetails.room_rate || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Subtotal:</td>
                <td>KES ${(bookingDetails.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Taxes (16% VAT):</td>
                <td>KES ${(bookingDetails.tax_amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Service Charge (10%):</td>
                <td>KES ${(bookingDetails.service_charge || 0).toLocaleString()}</td>
              </tr>
              ${bookingDetails.discount_amount ? `<tr><td>Discount Applied:</td><td>-KES ${bookingDetails.discount_amount.toLocaleString()}</td></tr>` : ''}
              <tr style="border-top: 2px solid #3C3C43; font-weight: bold; font-size: 16px;">
                <td class="highlight">Grand Total:</td>
                <td class="highlight">KES ${(bookingDetails.total_amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="highlight">Payment Status:</td>
                <td style="color: #2d5a2d; font-weight: bold;">${bookingDetails.deposit_paid ? 'PAID IN FULL' : 'DEPOSIT PAID'}</td>
              </tr>
              <tr>
                <td>Payment Method:</td>
                <td>${bookingDetails.payment_method || 'Card Payment'}</td>
              </tr>
            </table>
          </div>

          <div class="booking-details">
            <h3>🏨 Hotel Information</h3>
            <table>
              <tr>
                <td class="highlight">Hotel Name:</td>
                <td>Famous Gates Hotels</td>
              </tr>
              <tr>
                <td class="highlight">Address:</td>
                <td>Bomet, Kenya</td>
              </tr>
              <tr>
                <td class="highlight">Phone:</td>
                <td>0706 782 828</td>
              </tr>
              <tr>
                <td class="highlight">Email:</td>
                <td>famous-gates-hotelsbmt@gmail.com</td>
              </tr>
              <tr>
                <td class="highlight">Website:</td>
                <td><a href="#">www.famous-gates-hotels.hirall.com</a></td>
              </tr>
            </table>
          </div>

          ${bookingDetails.special_requests ? `
          <div class="booking-details">
            <h3>📝 Special Requests</h3>
            <p style="background: #f0f8ff; padding: 10px; border-radius: 5px; border-left: 4px solid #3C3C43;">
              ${bookingDetails.special_requests}
              <br><small style="color: #666;">Note: Special requests are subject to availability and may incur additional charges.</small>
            </p>
          </div>
          ` : ''}

          <div class="booking-details">
            <h3>📋 Important Instructions</h3>
            <ul style="padding-left: 20px; line-height: 1.8;">
              <li><strong>Check-in Time:</strong> From 3:00 PM onwards</li>
              <li><strong>Check-out Time:</strong> By 11:00 AM</li>
              <li><strong>Required Documents:</strong> Valid ID and credit card for incidentals</li>
              <li><strong>Cancellation Policy:</strong> Free cancellation up to 24 hours before arrival</li>
              <li><strong>COVID-19 Protocols:</strong> Please follow all health and safety guidelines</li>
              <li><strong>Parking:</strong> Complimentary parking available</li>
            </ul>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="color: #3C3C43; margin-top: 0;">🎯 Quick Actions</h3>
            <div style="margin: 15px 0;">
              <a href="#" style="display: inline-block; background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">View Full Details</a>
              <a href="#" style="display: inline-block; background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Modify Booking</a>
            </div>
            <div style="margin: 15px 0;">
              <a href="#" style="display: inline-block; background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Add to Calendar</a>
              <a href="#" style="display: inline-block; background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Contact Us</a>
            </div>
          </div>

          <div class="booking-details">
            <h3>📅 What's Next?</h3>
            <ul style="padding-left: 20px; line-height: 1.8;">
              <li>We'll send you a reminder 48 hours before check-in</li>
              <li>Download our mobile app for mobile check-in</li>
              <li>Complete your pre-check-in form (link will be sent separately)</li>
              <li>Contact us for any special arrangements or questions</li>
            </ul>
          </div>

          <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0; color: white;">🌟 We're Excited to Welcome You! 🌟</h2>
            <p style="margin: 10px 0; font-size: 16px;">Thank you for choosing Famous Gates Hotels. We're committed to making your stay exceptional!</p>
          </div>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>
          Email: famous-gates-hotelsbmt@gmail.com<br>
          Phone: 0706 782 828</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Welcome email template
  welcome: (name: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3C3C43; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .features { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Famous Gates Hotels!</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          <p>Welcome to the Famous Gates Hotels team! We're excited to have you on board.</p>
          
          <div class="features">
            <h3>You now have access to:</h3>
            <ul>
              <li>Staff dashboard and scheduling system</li>
              <li>Task management and assignments</li>
              <li>Internal communication tools</li>
              <li>Training materials and resources</li>
              <li>Payroll and HR information</li>
            </ul>
          </div>

          <p>If you have any questions or need assistance, please don't hesitate to contact your supervisor or the HR department.</p>
          
          <p>We look forward to working with you!</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels Management<br>
          HR Department</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Password reset template
  passwordReset: (resetUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3C3C43; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .button { 
          display: inline-block; 
          background: #3C3C43; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 15px 0;
        }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>You are receiving this email because you (or someone else) has requested to reset your password for your Famous Gates Hotels account.</p>
          
          <p>Please click the button below to reset your password:</p>
          
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          
          <div class="warning">
            <p><strong>Important:</strong> This link will expire in 10 minutes for security reasons.</p>
          </div>
          
          <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels Security Team</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Maintenance alert template
  maintenanceAlert: (taskDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Maintenance Alert - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b35; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .task-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
        .priority-high { color: #e74c3c; font-weight: bold; }
        .priority-medium { color: #f39c12; font-weight: bold; }
        .priority-low { color: #27ae60; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔧 Maintenance Alert</h1>
        </div>
        <div class="content">
          <p>A new maintenance task has been assigned to you:</p>
          
          <div class="task-details">
            <table>
              <tr>
                <td class="highlight">Task ID:</td>
                <td>${taskDetails.id || taskDetails.task_number}</td>
              </tr>
              <tr>
                <td class="highlight">Location:</td>
                <td>${taskDetails.location || taskDetails.room_number}</td>
              </tr>
              <tr>
                <td class="highlight">Priority:</td>
                <td class="priority-${taskDetails.priority}">${taskDetails.priority?.toUpperCase()}</td>
              </tr>
              <tr>
                <td class="highlight">Issue Type:</td>
                <td>${taskDetails.issue_type || taskDetails.type}</td>
              </tr>
              <tr>
                <td class="highlight">Description:</td>
                <td>${taskDetails.description}</td>
              </tr>
              <tr>
                <td class="highlight">Reported By:</td>
                <td>${taskDetails.reported_by || 'System'}</td>
              </tr>
              <tr>
                <td class="highlight">Created:</td>
                <td>${new Date(taskDetails.created_at || Date.now()).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <p>Please log into the maintenance portal to view full details and update the task status.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels Maintenance Department</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Inventory alert template
  // Booking cancellation template
  bookingCancellation: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancellation - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
        .cancelled { color: #e74c3c; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
          <p>Your reservation at Famous Gates Hotels has been cancelled as requested.</p>
          
          <div class="booking-details">
            <h3 class="cancelled">Cancellation Details</h3>
            <table>
              <tr>
                <td class="highlight">Booking Reference:</td>
                <td>${bookingDetails.confirmation_number || bookingDetails.id}</td>
              </tr>
              <tr>
                <td class="highlight">Check-in Date:</td>
                <td>${new Date(bookingDetails.check_in).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="highlight">Check-out Date:</td>
                <td>${new Date(bookingDetails.check_out).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="highlight">Room Type:</td>
                <td>${bookingDetails.room_type || 'Standard Room'}</td>
              </tr>
              <tr>
                <td class="highlight">Cancellation Reason:</td>
                <td>${bookingDetails.cancellation_reason || 'Guest request'}</td>
              </tr>
              <tr>
                <td class="highlight">Cancelled At:</td>
                <td>${new Date(bookingDetails.cancelled_at || Date.now()).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div class="booking-details">
            <h3>Refund Information</h3>
            <p>If a refund is applicable per our cancellation policy, it will be processed to your original payment method within 5-7 business days.</p>
          </div>

          <p>We hope to welcome you again in the future. If you have any questions, please contact us.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828<br>Email: famous-gates-hotelsbmt@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Payment receipt template
  paymentReceipt: (paymentDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .receipt-box { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border: 2px solid #27ae60; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
        .paid { color: #27ae60; font-weight: bold; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Receipt</h1>
        </div>
        <div class="content">
          <p>Dear ${paymentDetails.guest_name || 'Guest'},</p>
          <p>Thank you for your payment. Here is your receipt:</p>
          
          <div class="receipt-box">
            <h2 style="text-align: center; margin-top: 0;">Famous Gates Hotels</h2>
            <p style="text-align: center; color: #666;">Bomet, Kenya</p>
            <hr>
            <table>
              <tr>
                <td class="highlight">Receipt No:</td>
                <td>${paymentDetails.receipt_number || paymentDetails.id}</td>
              </tr>
              <tr>
                <td class="highlight">Date:</td>
                <td>${new Date(paymentDetails.payment_date || Date.now()).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="highlight">Booking Ref:</td>
                <td>${paymentDetails.confirmation_number || paymentDetails.booking_id}</td>
              </tr>
              <tr>
                <td class="highlight">Guest Name:</td>
                <td>${paymentDetails.guest_name || 'Guest'}</td>
              </tr>
              <tr>
                <td class="highlight">Description:</td>
                <td>${paymentDetails.description || 'Room booking payment'}</td>
              </tr>
              <tr>
                <td class="highlight">Amount Paid:</td>
                <td class="paid">KES ${(paymentDetails.amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="highlight">Payment Method:</td>
                <td>${paymentDetails.payment_method || 'Card'}</td>
              </tr>
              <tr>
                <td class="highlight">Transaction Ref:</td>
                <td>${paymentDetails.transaction_reference || 'N/A'}</td>
              </tr>
            </table>
            <hr>
            <p style="text-align: center;" class="paid">PAYMENT CONFIRMED</p>
          </div>

          <p>If you have any questions about this receipt, please contact our front desk.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828<br>Email: famous-gates-hotelsbmt@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Invoice template
  invoice: (invoiceDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3C3C43; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .invoice-box { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
        th { background: #F2F2F7; font-weight: bold; }
        .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #3C3C43; }
        .status-paid { color: #27ae60; font-weight: bold; }
        .status-unpaid { color: #e74c3c; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice</h1>
        </div>
        <div class="content">
          <p>Dear ${invoiceDetails.guest_name || 'Guest'},</p>
          <p>Please find your invoice below:</p>
          
          <div class="invoice-box">
            <h2 style="margin-top: 0;">Famous Gates Hotels</h2>
            <p style="color: #666;">Bomet, Kenya | Phone: 0706 782 828</p>
            <hr>
            <table>
              <tr>
                <th colspan="2">Invoice Details</th>
              </tr>
              <tr>
                <td>Invoice Number:</td>
                <td>${invoiceDetails.invoice_number || invoiceDetails.id}</td>
              </tr>
              <tr>
                <td>Date:</td>
                <td>${new Date(invoiceDetails.invoice_date || Date.now()).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td>Booking Ref:</td>
                <td>${invoiceDetails.confirmation_number || invoiceDetails.booking_id}</td>
              </tr>
              <tr>
                <td>Guest Name:</td>
                <td>${invoiceDetails.guest_name || 'Guest'}</td>
              </tr>
              <tr>
                <td>Status:</td>
                <td class="${invoiceDetails.status === 'paid' ? 'status-paid' : 'status-unpaid'}">${(invoiceDetails.status || 'unpaid').toUpperCase()}</td>
              </tr>
            </table>
            
            <table style="margin-top: 15px;">
              <tr>
                <th>Description</th>
                <th>Amount (KES)</th>
              </tr>
              <tr>
                <td>Room Charges (${invoiceDetails.nights || 1} nights)</td>
                <td>${(invoiceDetails.room_charges || 0).toLocaleString()}</td>
              </tr>
              ${(invoiceDetails.extras || []).map((extra: any) => `
              <tr>
                <td>${extra.description}</td>
                <td>${(extra.amount || 0).toLocaleString()}</td>
              </tr>
              `).join('')}
              <tr>
                <td>Subtotal</td>
                <td>${(invoiceDetails.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Tax (16% VAT)</td>
                <td>${(invoiceDetails.tax_amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Service Charge (10%)</td>
                <td>${(invoiceDetails.service_charge || 0).toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <td>Total Amount</td>
                <td>KES ${(invoiceDetails.total_amount || 0).toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <td>Amount Paid</td>
                <td>KES ${(invoiceDetails.amount_paid || 0).toLocaleString()}</td>
              </tr>
              ${(invoiceDetails.total_amount || 0) > (invoiceDetails.amount_paid || 0) ? `
              <tr class="total-row status-unpaid">
                <td>Balance Due</td>
                <td>KES ${((invoiceDetails.total_amount || 0) - (invoiceDetails.amount_paid || 0)).toLocaleString()}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <p>Thank you for choosing Famous Gates Hotels. We look forward to your stay.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828<br>Email: famous-gates-hotelsbmt@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Check-in reminder template
  checkInReminder: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Check-in Reminder - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3498db; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Check-in Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
          <p>This is a friendly reminder that your check-in at Famous Gates Hotels is tomorrow!</p>
          
          <div class="booking-details">
            <h3>Reservation Summary</h3>
            <table>
              <tr>
                <td class="highlight">Booking Reference:</td>
                <td>${bookingDetails.confirmation_number || bookingDetails.id}</td>
              </tr>
              <tr>
                <td class="highlight">Check-in Date:</td>
                <td>${new Date(bookingDetails.check_in).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="highlight">Check-out Date:</td>
                <td>${new Date(bookingDetails.check_out).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="highlight">Room Number:</td>
                <td>${bookingDetails.room_number || 'Will be assigned upon arrival'}</td>
              </tr>
              <tr>
                <td class="highlight">Room Type:</td>
                <td>${bookingDetails.room_type || 'Standard Room'}</td>
              </tr>
            </table>
          </div>

          <div class="booking-details">
            <h3>What to Bring</h3>
            <ul>
              <li>Valid ID or Passport</li>
              <li>Booking confirmation (this email)</li>
              <li>Credit card for incidentals</li>
            </ul>
          </div>

          <p>Check-in starts from 3:00 PM. If you need early check-in, please contact us in advance.</p>
          <p>We look forward to welcoming you!</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828<br>Email: famous-gates-hotelsbmt@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Check-out reminder template
  checkOutReminder: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Check-out Reminder - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9b59b6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Check-out Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
          <p>We hope you enjoyed your stay at Famous Gates Hotels. This is a reminder that your check-out is tomorrow by 11:00 AM.</p>
          
          <div class="booking-details">
            <h3>Stay Summary</h3>
            <table>
              <tr>
                <td class="highlight">Booking Reference:</td>
                <td>${bookingDetails.confirmation_number || bookingDetails.id}</td>
              </tr>
              <tr>
                <td class="highlight">Check-out Date:</td>
                <td>${new Date(bookingDetails.check_out).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="highlight">Room Number:</td>
                <td>${bookingDetails.room_number || '-'}</td>
              </tr>
              <tr>
                <td class="highlight">Balance:</td>
                <td>KES ${(bookingDetails.balance || 0).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <p>Please settle any outstanding balance at the front desk before departure. Late check-out may be available upon request (subject to availability and additional charges).</p>
          <p>Thank you for choosing Famous Gates Hotels. We hope to see you again soon!</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828<br>Email: famous-gates-hotelsbmt@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Check-in welcome template (sent after check-in)
  checkInWelcome: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .welcome-box { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Famous Gates Hotels!</h1>
        </div>
        <div class="content">
          <div class="welcome-box">
            <h2 style="color: #27ae60; margin-top: 0;">Checked In Successfully</h2>
            <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
            <p>Welcome! We are delighted to have you as our guest.</p>
          </div>
          
          <div class="welcome-box">
            <h3>Your Room Details</h3>
            <table>
              <tr>
                <td class="highlight">Room Number:</td>
                <td>${bookingDetails.room_number || '-'}</td>
              </tr>
              <tr>
                <td class="highlight">WiFi Password:</td>
                <td>FamousGate2024</td>
              </tr>
              <tr>
                <td class="highlight">Breakfast:</td>
                <td>6:30 AM - 10:00 AM (Main Restaurant)</td>
              </tr>
              <tr>
                <td class="highlight">Front Desk:</td>
                <td>Available 24/7 | Dial 0 from your room</td>
              </tr>
            </table>
          </div>

          <p>Enjoy your stay! If you need anything, our team is here to help.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels<br>Phone: 0706 782 828</p>
        </div>
      </div>
    </body>
    </html>
  `,

  inventoryAlert: (itemDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Low Stock Alert - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f39c12; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .item-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .highlight { background: #F2F2F7; font-weight: bold; }
        .low-stock { color: #e74c3c; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 Low Stock Alert</h1>
        </div>
        <div class="content">
          <p>The following item is running low on stock and needs to be reordered:</p>
          
          <div class="item-details">
            <table>
              <tr>
                <td class="highlight">Item Code:</td>
                <td>${itemDetails.item_code || itemDetails.sku}</td>
              </tr>
              <tr>
                <td class="highlight">Item Name:</td>
                <td>${itemDetails.name || itemDetails.description}</td>
              </tr>
              <tr>
                <td class="highlight">Current Stock:</td>
                <td class="low-stock">${itemDetails.current_stock || itemDetails.quantity}</td>
              </tr>
              <tr>
                <td class="highlight">Minimum Stock Level:</td>
                <td>${itemDetails.minimum_stock || itemDetails.reorder_level}</td>
              </tr>
              <tr>
                <td class="highlight">Category:</td>
                <td>${itemDetails.category || 'N/A'}</td>
              </tr>
              <tr>
                <td class="highlight">Supplier:</td>
                <td>${itemDetails.supplier || 'N/A'}</td>
              </tr>
            </table>
          </div>

          <p><strong>Action Required:</strong> Please create a purchase order for this item as soon as possible to avoid stockouts.</p>
        </div>
        <div class="footer">
          <p>Famous Gates Hotels Inventory Management</p>
        </div>
      </div>
    </body>
    </html>
  `
};
