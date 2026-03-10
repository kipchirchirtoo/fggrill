/**
 * Landing Page Email Templates
 * Migrated from landing-page/src/templates/emails/
 */

export const landingEmailTemplates = {
  /**
   * Generates the HTML string for a Booking Confirmation email.
   */
  bookingConfirmation: (data: {
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
  }) => {
    // Generate barcode URL
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${data.confirmationNumber}&code=Code128&translate-esc=on&dpi=96&imagetype=Gif`;
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
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
        <div class="company-name">${data.hotelName.toUpperCase()}</div>
      </div>
      <div class="contact-info">
        ${data.hotelAddress}<br>
        <a href="mailto:${data.hotelEmail}">${data.hotelEmail}</a> | 
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
        <strong>Subject:</strong> <span class="subject-text">Booking Confirmation - ${data.confirmationNumber}</span>
      </div>
      
      <div class="greeting">Dear ${data.guestName},</div>
      
      <div class="intro-text">
        Thank you for choosing ${data.hotelName}. We are pleased to confirm your reservation. 
        This email serves as your official booking confirmation. Please review the details below 
        and contact us if you have any questions.
      </div>
      
      <!-- Barcode Section -->
      <div class="barcode-section">
        <div class="barcode-label">Confirmation Number</div>
        <div class="barcode-number">${data.confirmationNumber}</div>
        <div class="barcode">
          <img src="${barcodeUrl}" alt="Confirmation Barcode" />
        </div>
      </div>
      
      <!-- Reservation Details -->
      <div class="section-title">Reservation Details</div>
      <ul class="detail-list">
        <li><span class="detail-label">Guest Name:</span> <span class="detail-value">${data.guestName || 'Valued Guest'}</span></li>
        <li><span class="detail-label">Number of Guests:</span> <span class="detail-value">${data.guests || 1} guest${Number(data.guests || 1) > 1 ? 's' : ''}</span></li>
        <li><span class="detail-label">Room Type:</span> <span class="detail-value">${data.roomType}</span></li>
        <li><span class="detail-label">Check-in Date:</span> <span class="detail-value">${data.checkInDate}</span></li>
        <li><span class="detail-label">Check-out Date:</span> <span class="detail-value">${data.checkOutDate}</span></li>
      </ul>
      
      <!-- Amount -->
      <div class="amount-section">
        <div class="amount-label">Total Amount</div>
        <div class="amount-value">KES ${Number(data.totalAmount || 0).toLocaleString()}</div>
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
        We look forward to welcoming you to ${data.hotelName}. Should you require any 
        special arrangements or have questions about your reservation, please do not 
        hesitate to contact us.
      </div>
      
      <div class="signature">
        Warm regards,<br>
        <strong>${data.hotelName} Team</strong>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <img src="https://i.ibb.co/S45vFwsd/fglogoo.png" alt="FG" class="footer-logo" />
      <div class="footer-company">${data.hotelName.toUpperCase()}</div>
      <div class="footer-text">${data.hotelAddress}</div>
      <div class="footer-text">
        <a href="tel:+254706782828" class="footer-link">+254 706 782 828</a> • 
        <a href="mailto:${data.hotelEmail}" class="footer-link">${data.hotelEmail}</a>
      </div>
      <div class="footer-text" style="margin-top: 15px; font-size: 11px; color: #999999;">
        © ${new Date().getFullYear()} ${data.hotelName}. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
`;
  },

  /**
   * Generates the HTML string for a Reservation Request email.
   */
  reservationRequest: (data: {
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
    body { font-family: 'Inter', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #fafafa; color: #334155; }
    .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; }
    .header { background-color: #f8fafc; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    .badge { display: inline-block; background-color: #fef3c7; color: #b45309; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 24px; color: #0f172a; font-weight: 600; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; font-weight: 500; color: #1e293b; }
    .summary-card { background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-top: 30px; margin-bottom: 30px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
    .row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .label { color: #64748b; font-size: 14px; }
    .value { font-weight: 600; color: #0f172a; font-size: 15px; text-align: right; }
    .total-row { margin-top: 20px; padding-top: 20px; border-top: 2px dashed #cbd5e0; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 16px; font-weight: 600; color: #334155; }
    .total-value { font-size: 24px; font-weight: 700; color: #2563eb; }
    .action-container { text-align: center; margin-top: 40px; }
    .btn { display: inline-block; background-color: #2563eb; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; }
    .notice { text-align: center; font-size: 13px; color: #94a3b8; margin-top: 15px; }
    .footer { text-align: center; padding: 30px; font-size: 13px; color: #64748b; background-color: #ffffff; border-top: 1px solid #f1f5f9; }
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
        <div class="row"><div class="label">Reservation ID</div><div class="value">${data.reservationId}</div></div>
        <div class="row"><div class="label">Dates</div><div class="value">${data.checkInDate} &mdash; ${data.checkOutDate}</div></div>
        <div class="row"><div class="label">Accommodations</div><div class="value">${data.roomType}<br><span style="font-size: 13px; color: #64748b; font-weight: normal;">${data.guests} Guest${data.guests > 1 ? 's' : ''}</span></div></div>
        <div class="total-row"><div class="total-label">Amount Due</div><div class="total-value">KSH ${Number(data.totalAmount || 0).toLocaleString()}</div></div>
      </div>
      <div class="action-container">
        <a href="${data.paymentLink}" class="btn">Proceed to Payment &rarr;</a>
        <div class="notice">This payment link will expire in 24 hours. Your room is not guaranteed until payment is received.</div>
      </div>
    </div>
    <div class="footer">
      <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">${data.hotelName}</div>
      <div>${data.hotelAddress}</div>
      <div style="margin-top: 10px;">Need help? Call <a href="tel:${data.hotelPhone.replace(/\s+/g, '')}" style="color: #2563eb;">${data.hotelPhone}</a></div>
    </div>
  </div>
</body>
</html>
`,

  /**
   * Generates the HTML string for a Promotional offer email.
   */
  promotion: (data: {
    guestName: string;
    promoTitle: string;
    promoHeadline: string;
    promoDescription: string;
    promoCode: string;
    discountPercentage: string;
    validUntil: string;
    bookingLink: string;
    hotelName: string;
    hotelAddress: string;
    heroImageUrl?: string;
  }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.promoTitle}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #fce7f3; color: #3f1d38; }
    .email-container { max-width: 600px; margin: 30px auto; background-color: #ffffff; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .hero-image { width: 100%; height: 300px; background-image: url('${data.heroImageUrl || 'https://images.unsplash.com/photo-1542314831-c6a4d27df08d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'}'); background-size: cover; background-position: center; position: relative; }
    .logo-overlay { position: absolute; top: 20px; width: 100%; text-align: center; }
    .content { padding: 50px 40px; text-align: center; background-color: #fff1f2; }
    .greeting { font-size: 18px; margin-bottom: 10px; color: #be123c; font-weight: 500; }
    .headline { font-size: 42px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.1; color: #881337; text-transform: uppercase; }
    .discount-box { display: inline-block; border: 3px solid #e11d48; padding: 15px 30px; margin: 25px 0; position: relative; }
    .discount-value { font-size: 48px; font-weight: 900; color: #e11d48; line-height: 1; }
    .promo-code-container { background-color: #f1f5f9; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e0; display: inline-block; margin-bottom: 40px; }
    .code-text { font-family: monospace; font-size: 20px; font-weight: bold; color: #0f172a; letter-spacing: 2px; }
    .btn { display: inline-block; background-color: #e11d48; color: white !important; text-decoration: none; padding: 18px 40px; font-size: 16px; font-weight: bold; text-transform: uppercase; }
    .footer { background-color: #1e293b; color: #94a3b8; text-align: center; padding: 40px 20px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="hero-image">
      <div class="logo-overlay"><img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 60px; filter: brightness(0) invert(1);"></div>
    </div>
    <div class="content">
      <div class="greeting">Hi ${data.guestName},</div>
      <h1 class="headline">${data.promoHeadline}</h1>
      <div class="discount-box"><div class="discount-value">${data.discountPercentage} OFF</div></div>
      <p>${data.promoDescription}</p>
      <div class="promo-code-container">Use Code: <span class="code-text">${data.promoCode}</span></div><br>
      <a href="${data.bookingLink}" class="btn">Claim Offer Now</a>
      <div style="font-size: 12px; color: #64748b; margin-top: 15px; font-style: italic;">*Offer valid until ${data.validUntil}.</div>
    </div>
    <div class="footer"><strong>${data.hotelName}</strong><div>${data.hotelAddress}</div></div>
  </div>
</body>
</html>
`,

  /**
   * Generates the HTML string for a Luxury Hotel Newsletter email.
   */
  newsletter: (data: {
    guestName: string;
    issueDate: string;
    newsletterTitle: string;
    featuredArticle: {
      title: string;
      description: string;
      imageUrl: string;
      readMoreLink: string;
    };
    secondaryArticles: Array<{
      title: string;
      description: string;
      imageUrl: string;
      readMoreLink: string;
    }>;
    bookingLink: string;
    hotelName: string;
    hotelAddress: string;
    hotelPhone: string;
  }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.hotelName} Newsletter</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #2c3e50; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .top-bar { background-color: #1a1a1a; color: #d4af37; text-align: center; padding: 15px; font-size: 12px; text-transform: uppercase; }
    .logo-container { text-align: center; padding: 40px 20px 20px 20px; }
    .issue-date { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #7f8c8d; text-transform: uppercase; margin-top: 10px; }
    .content { padding: 0 30px 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 25px; text-align: center; font-style: italic; }
    .featured-article img { width: 100%; height: 350px; object-fit: cover; margin-bottom: 20px; }
    .read-more { font-size: 12px; color: #d4af37; text-decoration: none; text-transform: uppercase; border-bottom: 1px solid #d4af37; padding-bottom: 3px; }
    .secondary-articles { display: table; width: 100%; margin-top: 40px; }
    .secondary-article { display: table-cell; width: 50%; padding: 10px; text-align: center; }
    .secondary-article img { width: 100%; height: 180px; object-fit: cover; margin-bottom: 15px; }
    .btn { background-color: #1a1a1a; color: #ffffff !important; text-decoration: none; padding: 14px 35px; font-size: 13px; text-transform: uppercase; display: inline-block; margin-top: 20px; }
    .footer { background-color: #1a1a1a; padding: 40px 30px; text-align: center; font-size: 11px; color: #7f8c8d; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="top-bar">The ${data.hotelName} Collection</div>
    <div class="logo-container"><img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 100px; margin-bottom: 20px;"><h1>${data.hotelName}</h1><div class="issue-date">${data.issueDate}</div></div>
    <div class="content">
      <div class="greeting">Dear ${data.guestName},</div>
      <div class="featured-article">
        <img src="${data.featuredArticle.imageUrl}" alt="${data.featuredArticle.title}">
        <h2>${data.featuredArticle.title}</h2>
        <p>${data.featuredArticle.description}</p>
        <a href="${data.featuredArticle.readMoreLink}" class="read-more">Read Full Story</a>
      </div>
      <div class="secondary-articles">
        ${data.secondaryArticles.map(article => `
          <div class="secondary-article">
            <img src="${article.imageUrl}" alt="${article.title}">
            <h3>${article.title}</h3>
            <a href="${article.readMoreLink}" class="read-more">Discover More</a>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="action-banner" style="text-align: center; padding: 40px; background: #f9f9f9;">
      <h2>Plan Your Next Escape</h2>
      <a href="${data.bookingLink}" class="btn">Book Your Stay</a>
    </div>
    <div class="footer"><div>${data.hotelAddress}</div><div>T: ${data.hotelPhone}</div></div>
  </div>
</body>
</html>
`
};
