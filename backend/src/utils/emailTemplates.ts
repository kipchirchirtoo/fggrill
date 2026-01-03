export const emailTemplates = {
  // Booking confirmation template (Enhanced for complete booking journey)
  bookingConfirmation: (bookingDetails: any, barcodeBase64?: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - Famous Gate Hotel</title>
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
          <h1>Famous Gate Hotel</h1>
          <h2>Booking Confirmation</h2>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name || 'Guest'},</p>
          <p>Thank you for choosing Famous Gate Hotel! Your booking has been confirmed.</p>
          
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
                <td>Famous Gate Hotel</td>
              </tr>
              <tr>
                <td class="highlight">Address:</td>
                <td>123 Hotel Street, Nairobi, Kenya</td>
              </tr>
              <tr>
                <td class="highlight">Phone:</td>
                <td>+254 XXX XXX XXX</td>
              </tr>
              <tr>
                <td class="highlight">Email:</td>
                <td>info@famousgatehotel.com</td>
              </tr>
              <tr>
                <td class="highlight">Website:</td>
                <td><a href="#">www.famousgatehotel.com</a></td>
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
            <p style="margin: 10px 0; font-size: 16px;">Thank you for choosing Famous Gate Hotel. We're committed to making your stay exceptional!</p>
          </div>
        </div>
        <div class="footer">
          <p>Famous Gate Hotel<br>
          Email: info@famousgatehotel.com<br>
          Phone: +254 XXX XXX XXX</p>
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
      <title>Welcome to Famous Gate Hotel</title>
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
          <h1>Welcome to Famous Gate Hotel!</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          <p>Welcome to the Famous Gate Hotel team! We're excited to have you on board.</p>
          
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
          <p>Famous Gate Hotel Management<br>
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
      <title>Password Reset - Famous Gate Hotel</title>
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
          <p>You are receiving this email because you (or someone else) has requested to reset your password for your Famous Gate Hotel account.</p>
          
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
          <p>Famous Gate Hotel Security Team</p>
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
      <title>Maintenance Alert - Famous Gate Hotel</title>
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
          <p>Famous Gate Hotel Maintenance Department</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Inventory alert template
  inventoryAlert: (itemDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Low Stock Alert - Famous Gate Hotel</title>
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
          <p>Famous Gate Hotel Inventory Management</p>
        </div>
      </div>
    </body>
    </html>
  `
};
