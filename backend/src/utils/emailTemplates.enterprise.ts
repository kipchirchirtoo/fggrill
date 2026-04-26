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
        <div class="header"><div class="logo">Famous Gates Hotels</div></div>
        <div class="content">
          <h1>Booking Confirmed</h1>
          <p>Dear ${bookingDetails.guest_name || 'Guest'}, your stay is confirmed.</p>
          <div class="section">
            <div class="section-title">Details</div>
            <p>Check-in: ${new Date(bookingDetails.check_in).toLocaleDateString()}</p>
            <p>Check-out: ${new Date(bookingDetails.check_out).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} Famous Gates Hotels</div>
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
        <div class="header"><div class="logo">Famous Gates Hotels</div></div>
        <div class="content">
          <h2>Payslip Available</h2>
          <p>Dear ${staffName}, your payslip for ${month} ${year} is attached.</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} Famous Gates Hotels</div>
      </div>
    </body>
    </html>
  `,
  purchaseOrder: (supplierName: string, poDetails: any) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order: ${poDetails.po_number}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #3c3c43; background-color: #ffffff; margin: 0; padding: 0; }
        .wrapper { max-width: 700px; margin: 0 auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f2f2f7; padding-bottom: 20px; }
        .company-info h1 { margin: 0; color: #1d1d1f; font-size: 24px; }
        .po-header { text-align: right; }
        .po-header h2 { margin: 0; color: #007AFF; font-size: 28px; }
        .po-header p { margin: 4px 0; color: #86868b; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .info-box h3 { font-size: 12px; text-transform: uppercase; color: #86868b; margin-bottom: 8px; border-bottom: 1px solid #f2f2f7; padding-bottom: 4px; }
        .info-box p { margin: 4px 0; font-size: 14px; }
        table { w-full; border-collapse: collapse; margin-bottom: 40px; }
        th { text-align: left; padding: 12px; background-color: #f5f5f7; color: #86868b; font-size: 11px; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #f2f2f7; font-size: 14px; }
        .totals { margin-left: auto; width: 250px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-row.grand { border-top: 2px solid #1d1d1f; margin-top: 8px; padding-top: 12px; font-weight: 700; font-size: 18px; color: #1d1d1f; }
        .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f2f2f7; font-size: 12px; color: #86868b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="company-info">
            <h1>Famous Gate Hotels</h1>
            <p>Central Stores & Logistics Hub</p>
            <p>P.O. Box 123, Bomet, Kenya</p>
          </div>
          <div class="po-header">
            <h2>PURCHASE ORDER</h2>
            <p><strong># ${poDetails.po_number}</strong></p>
            <p>Date: ${new Date(poDetails.po_date).toLocaleDateString()}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Supplier</h3>
            <p><strong>${supplierName}</strong></p>
            <p>${poDetails.supplier?.address || ''}</p>
            <p>${poDetails.supplier?.email || ''}</p>
            <p>${poDetails.supplier?.phone || ''}</p>
          </div>
          <div class="info-box">
            <h3>Ship To</h3>
            <p><strong>Famous Gate Hotels - Central Store</strong></p>
            <p>Main Distribution Center</p>
            <p>Expected: ${poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'ASAP'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item / Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(poDetails.items || []).map((item: any) => `
              <tr>
                <td>
                  <strong>${item.item_name || item.item?.description || item.item_id}</strong>
                </td>
                <td style="text-align: center;">${item.quantity_ordered || item.quantity}</td>
                <td style="text-align: right;">${Number(item.unit_price).toLocaleString()}</td>
                <td style="text-align: right;">${Number(item.total_price).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>KES ${Number(poDetails.subtotal || poDetails.total_amount).toLocaleString()}</span>
          </div>
          <div class="total-row">
            <span>Tax (VAT 0%)</span>
            <span>KES 0</span>
          </div>
          <div class="total-row grand">
            <span>Total</span>
            <span>KES ${Number(poDetails.total_amount).toLocaleString()}</span>
          </div>
        </div>

        <div class="info-box" style="margin-top: 40px;">
          <h3>Instructions</h3>
          <p>${poDetails.special_instructions || 'Please supply the items listed above as per our agreed terms.'}</p>
          <p>Payment Terms: ${poDetails.payment_terms || 'Standard 30 Days'}</p>
        </div>

        <div class="footer">
          <p>This is a system-generated Purchase Order and is valid without a signature when sent from our official domain.</p>
          <p>&copy; ${new Date().getFullYear()} Famous Gates Hotels. All Rights Reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

