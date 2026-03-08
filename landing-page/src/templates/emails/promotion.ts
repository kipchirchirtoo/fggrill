/**
 * Generates the HTML string for a Promotional offer email.
 * Modeled after the "Women's Day 50% OFF" reference.
 */
export const getPromotionEmailHtml = (data: {
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
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #fce7f3; /* Soft Pink Background */
      color: #3f1d38;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    .hero-image {
      width: 100%;
      height: 300px;
      background-color: #fbcfe8;
      background-image: url('${data.heroImageUrl || 'https://images.unsplash.com/photo-1542314831-c6a4d27df08d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'}');
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .hero-image::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.6));
    }
    .logo-overlay {
      position: absolute;
      top: 20px;
      left: 0;
      width: 100%;
      text-align: center;
      color: white;
      font-size: 20px;
      font-weight: 300;
      letter-spacing: 2px;
      z-index: 2;
    }
    .content {
      padding: 50px 40px;
      text-align: center;
      background-color: #fff1f2; /* Very light pink/rose */
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 10px;
      color: #be123c; /* Rose bold */
      font-weight: 500;
    }
    .headline {
      font-size: 42px;
      font-weight: 800;
      margin: 0 0 20px 0;
      line-height: 1.1;
      color: #881337; /* Very dark rose */
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .highlight {
      color: #e11d48; /* Bright rose */
    }
    .discount-box {
      display: inline-block;
      border: 3px solid #e11d48;
      padding: 15px 30px;
      margin: 25px 0;
      position: relative;
    }
    .discount-label {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #fff1f2;
      padding: 0 10px;
      font-size: 12px;
      color: #be123c;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .discount-value {
      font-size: 48px;
      font-weight: 900;
      color: #e11d48;
      line-height: 1;
    }
    .description {
      font-size: 16px;
      line-height: 1.6;
      color: #4c1d95; /* Deep purple/rose tone */
      margin-bottom: 30px;
    }
    .promo-code-container {
      background-color: #f1f5f9;
      padding: 15px;
      border-radius: 8px;
      border: 1px dashed #cbd5e0;
      display: inline-block;
      margin-bottom: 40px;
    }
    .code-text {
      font-family: monospace;
      font-size: 20px;
      font-weight: bold;
      color: #0f172a;
      letter-spacing: 2px;
    }
    .btn {
      display: inline-block;
      background-color: #e11d48;
      color: white !important;
      text-decoration: none;
      padding: 18px 40px;
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #be123c;
    }
    .validity {
      font-size: 12px;
      color: #64748b;
      margin-top: 15px;
      font-style: italic;
    }
    .footer {
      background-color: #1e293b;
      color: #94a3b8;
      text-align: center;
      padding: 40px 20px;
      font-size: 13px;
    }
    .footer strong {
      color: #f8fafc;
      font-size: 16px;
      display: block;
      margin-bottom: 10px;
      letter-spacing: 1px;
    }
    .footer a {
      color: #94a3b8;
      text-decoration: underline;
    }
    .social-links {
      margin: 20px 0;
    }
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      width: 32px;
      height: 32px;
      background-color: #334155;
      border-radius: 50%;
      line-height: 32px;
      color: white;
      text-decoration: none;
    }
    .unsubscribe {
      margin-top: 30px;
      font-size: 11px;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 0;
      }
      .content {
        padding: 40px 20px;
      }
      .headline {
        font-size: 32px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="hero-image">
      <div class="logo-overlay">
        <img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 60px; filter: brightness(0) invert(1);">
      </div>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${data.guestName},</div>
      
      <!-- Headline Support: "Women's Day Special", "Weekend Getaway" -->
      <h1 class="headline">${data.promoHeadline}</h1>

      <div class="discount-box">
        <div class="discount-label">Exclusive Offer</div>
        <div class="discount-value">${data.discountPercentage} OFF</div>
      </div>
      
      <p class="description">
        ${data.promoDescription}
      </p>

      <div class="promo-code-container">
        Use Code: <span class="code-text">${data.promoCode}</span>
      </div>
      <br>

      <a href="${data.bookingLink}" class="btn">Claim Offer Now</a>
      
      <div class="validity">
        *Offer valid until ${data.validUntil}. Terms &amp; Conditions apply. Subject to availability.
      </div>
    </div>

    <div class="footer">
      <strong>${data.hotelName}</strong>
      <div>${data.hotelAddress}</div>
      <div class="social-links">
        <a href="#">Fb</a>
        <a href="#">Ig</a>
        <a href="#">Tw</a>
      </div>
      <div class="unsubscribe">
        You are receiving this email because you opted in at our website. <br>
        <a href="{{{ unsubscribe }}}">Unsubscribe</a> from promotional emails.
      </div>
    </div>
  </div>
</body>
</html>
`;
