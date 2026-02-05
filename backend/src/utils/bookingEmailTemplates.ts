export const bookingEmailSequence = {
  // Email 2: Pre-Arrival Email (7 days before check-in)
  preArrival: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Stay is Almost Here! - Famous Gates Hotels</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3C3C43; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .section { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌟 Your Stay is Almost Here!</h1>
          <p>Booking ID: ${bookingDetails.confirmation_number}</p>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>We're excited to welcome you to Famous Gates Hotels in just 7 days!</p>
          
          <div class="section">
            <h3>📅 Your Reservation Reminder</h3>
            <p><strong>Check-in:</strong> ${new Date(bookingDetails.check_in).toLocaleDateString()}</p>
            <p><strong>Room:</strong> ${bookingDetails.room_type}</p>
            <p><strong>Guests:</strong> ${bookingDetails.adults} Adults${bookingDetails.children ? `, ${bookingDetails.children} Children` : ''}</p>
          </div>

          <div class="section">
            <h3>🌤️ Weather Forecast</h3>
            <p>Expect pleasant weather with temperatures around 22-28°C. Perfect for exploring!</p>
          </div>

          <div class="section">
            <h3>🎯 Local Attractions</h3>
            <ul>
              <li>Nairobi National Park - 15 minutes away</li>
              <li>Karen Blixen Museum - 20 minutes away</li>
              <li>Giraffe Centre - 25 minutes away</li>
            </ul>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 3: Check-in Reminder (48 hours before)
  checkInReminder: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Check-in Reminder - Famous Gates Hotels</title>
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
          <h1>⏰ Check-in Reminder</h1>
          <p>Booking ID: ${bookingDetails.confirmation_number}</p>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>Your stay at Famous Gates Hotels begins in 48 hours!</p>
          
          <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>📋 What to Bring</h3>
            <ul>
              <li>Valid photo ID</li>
              <li>Credit card for incidentals</li>
              <li>Confirmation email (this one!)</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Mobile Check-in</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 4: Day-of Welcome Email
  dayOfWelcome: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 20px; text-align: center;">
          <h1>🎉 Welcome Day is Here!</h1>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>Welcome to your check-in day! We're ready for you at Famous Gates Hotels.</p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; text-align: center;">
            <h3>✅ Your Room is Being Prepared</h3>
            <p>Estimated ready time: 2:30 PM</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 5: Mid-Stay Check-in
  midStayCheckIn: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
          <h1>😊 How is Everything?</h1>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>We hope you're enjoying your stay! Is there anything we can do to make it even better?</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Quick Survey</a>
            <a href="#" style="background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Need Assistance</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 6: Pre-Departure Email
  preDeparture: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
          <h1>📦 Check-out Tomorrow</h1>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>Thank you for staying with us! Check-out is tomorrow by 11:00 AM.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
            <h3>Express Check-out Options</h3>
            <ul>
              <li>Leave key card in room</li>
              <li>Use mobile check-out</li>
              <li>Visit front desk</li>
            </ul>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 7: Post-Stay Thank You
  postStayThankYou: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 20px; text-align: center;">
          <h1>🙏 Thank You!</h1>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>Thank you for choosing Famous Gates Hotels! We hope you had a wonderful stay.</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Leave a Review</a>
            <a href="#" style="background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Book Again (10% Off)</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // Email 8: Review Reminder
  reviewReminder: (bookingDetails: any) => `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
          <h1>⭐ Share Your Experience</h1>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${bookingDetails.guest_name},</p>
          <p>We'd love to hear about your recent stay at Famous Gates Hotels!</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Leave Review</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
};
