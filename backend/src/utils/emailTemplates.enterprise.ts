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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #3c3c43; background-color: #f5f5f7; margin: 0; padding: 20px; }
        .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background-color: #ffffff; padding: 32px; border-bottom: 1px solid #f2f2f7; text-align: center; }
        .logo { font-size: 24px; font-weight: 700; color: #1d1d1f; }
        .content { padding: 40px 32px; }
        .section { margin-bottom: 32px; padding: 20px; background-color: #f5f5f7; border-radius: 8px; }
        .section-title { font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 12px; border-bottom: 1px solid #e5e5ea; padding-bottom: 8px; }
        .footer { padding: 32px; text-align: center; border-top: 1px solid #f2f2f7; font-size: 12px; color: #86868b; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header"><div class="logo">Famous Gate Hotel</div></div>
        <div class="content">
          <h1>Booking Confirmed</h1>
          <p>Dear ${bookingDetails.guest_name || 'Guest'}, your stay is confirmed.</p>
          <div class="section">
            <div class="section-title">Details</div>
            <p>Check-in: ${new Date(bookingDetails.check_in).toLocaleDateString()}</p>
            <p>Check-out: ${new Date(bookingDetails.check_out).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} Famous Gate Hotel</div>
      </div>
    </body>
    </html>
  `,
  payslipNotification: (staffName: string, month: string, year: number) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payslip Ready</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #3c3c43; background-color: #f5f5f7; margin: 0; padding: 20px; }
        .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background-color: #ffffff; padding: 32px; border-bottom: 1px solid #f2f2f7; text-align: center; }
        .logo { font-size: 24px; font-weight: 700; color: #1d1d1f; }
        .content { padding: 40px 32px; }
        .footer { padding: 32px; text-align: center; border-top: 1px solid #f2f2f7; font-size: 12px; color: #86868b; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header"><div class="logo">Famous Gate Hotel</div></div>
        <div class="content">
          <h2>Payslip Available</h2>
          <p>Dear ${staffName}, your payslip for ${month} ${year} is attached.</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} Famous Gate Hotel</div>
      </div>
    </body>
    </html>
  `
};
