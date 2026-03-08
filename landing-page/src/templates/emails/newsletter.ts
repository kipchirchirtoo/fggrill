/**
 * Generates the HTML string for a Luxury Hotel Newsletter email.
 * This is meant for general updates, articles, and "Book Now" highlights.
 */
export const getNewsletterEmailHtml = (data: {
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
    body {
      font-family: 'Georgia', serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #2c3e50;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    .top-bar {
      background-color: #1a1a1a;
      color: #d4af37;
      text-align: center;
      padding: 15px;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .logo-container {
      text-align: center;
      padding: 40px 20px 20px 20px;
    }
    .logo-container h1 {
      margin: 0;
      font-size: 32px;
      font-weight: normal;
      letter-spacing: 4px;
      color: #1a1a1a;
      text-transform: uppercase;
    }
    .issue-date {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #7f8c8d;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 10px;
    }
    .content {
      padding: 0 30px 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 25px;
      text-align: center;
      font-style: italic;
    }
    .intro {
      font-size: 16px;
      line-height: 1.8;
      text-align: center;
      color: #555555;
      margin-bottom: 40px;
    }
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 40px 0;
      position: relative;
    }
    .divider::after {
      content: '✦';
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #ffffff;
      padding: 0 10px;
      color: #d4af37;
      font-size: 18px;
    }
    .featured-article img {
      width: 100%;
      height: 350px;
      object-fit: cover;
      margin-bottom: 20px;
    }
    .featured-article h2 {
      font-size: 24px;
      margin: 0 0 15px 0;
      color: #1a1a1a;
      font-weight: normal;
    }
    .featured-article p {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 20px;
    }
    .read-more {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      display: inline-block;
      font-size: 12px;
      color: #d4af37;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #d4af37;
      padding-bottom: 3px;
    }
    .secondary-articles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 40px;
    }
    .secondary-article {
      text-align: center;
    }
    .secondary-article img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      margin-bottom: 15px;
    }
    .secondary-article h3 {
      font-size: 18px;
      margin: 0 0 10px 0;
      font-weight: normal;
    }
    .secondary-article p {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #7f8c8d;
      margin-bottom: 15px;
    }
    .action-banner {
      background-color: #f9f9f9;
      padding: 40px 30px;
      text-align: center;
      margin-top: 40px;
    }
    .action-banner h2 {
      margin: 0 0 15px 0;
      font-weight: normal;
      font-size: 22px;
    }
    .btn {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 35px;
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 20px;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #333333;
    }
    .footer {
      background-color: #1a1a1a;
      padding: 40px 30px;
      text-align: center;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #7f8c8d;
      line-height: 1.8;
    }
    .footer a {
      color: #d4af37;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .secondary-articles {
        grid-template-columns: 1fr;
      }
      .featured-article img {
        height: 250px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="top-bar">
      The ${data.hotelName} Collection
    </div>
    
    <div class="logo-container">
      <img src="https://famousgateshotels.com/fglogo.png" alt="FamousGate Logo" style="width: 100px; margin-bottom: 20px;">
      <h1>${data.hotelName}</h1>
      <div class="issue-date">${data.issueDate}</div>
    </div>

    <div class="content">
      <div class="greeting">Dear ${data.guestName},</div>
      <div class="intro">
        Welcome to the latest edition of our newsletter. ${data.newsletterTitle}. We invite you to discover our newest experiences and curated stories from around the property.
      </div>

      <div class="featured-article">
        <img src="${data.featuredArticle.imageUrl}" alt="${data.featuredArticle.title}">
        <h2>${data.featuredArticle.title}</h2>
        <p>${data.featuredArticle.description}</p>
        <a href="${data.featuredArticle.readMoreLink}" class="read-more">Read Full Story</a>
      </div>

      <div class="divider"></div>

      <div class="secondary-articles">
        ${data.secondaryArticles.map(article => `
          <div class="secondary-article">
            <img src="${article.imageUrl}" alt="${article.title}">
            <h3>${article.title}</h3>
            <p>${article.description}</p>
            <a href="${article.readMoreLink}" class="read-more">Discover More</a>
          </div>
        `).join('')}
      </div>

    </div>

    <div class="action-banner">
      <h2>Plan Your Next Escape</h2>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #555; font-size: 14px; margin-bottom: 0;">Immerse yourself in unparalleled luxury.</p>
      <a href="${data.bookingLink}" class="btn">Book Your Stay</a>
    </div>

    <div class="footer">
      <div>${data.hotelAddress}</div>
      <div>T: <a href="tel:${data.hotelPhone.replace(/\\s+/g, '')}">${data.hotelPhone}</a></div>
      <div style="margin: 20px 0;">
        <a href="#" style="margin: 0 10px;">Instagram</a> | 
        <a href="#" style="margin: 0 10px;">Facebook</a> | 
        <a href="#" style="margin: 0 10px;">Twitter</a>
      </div>
      <div>
        <a href="{{{ unsubscribe }}}" style="color: #7f8c8d; text-decoration: underline;">Unsubscribe</a> from our mailing list
      </div>
    </div>
  </div>
</body>
</html>
`;
