const nodemailer = require('nodemailer');

// Brevo SMTP configuration from your .env
const transporter = nodemailer.createTransporter({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: '96a507001@smtp-brevo.com',
    pass: process.env.SMTP_PASS || ''
  }
});

async function testEmail() {
  try {
    console.log('Testing email send...');
    
    const info = await transporter.sendMail({
      from: '"Famous Gates Hotels" <info@famousgatehotels.com>',
      to: 'allansamuel571@gmail.com, kipchirchirtoo01@gmail.com',
      subject: 'Test Email from FG Hotels Booking System',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify the email system is working.</p>
        <p>If you receive this, the SMTP configuration is correct.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `,
      text: 'This is a test email to verify the email system is working.'
    });

    console.log('✓ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('\nCheck your inbox (and spam folder) for the test email.');
    
  } catch (error) {
    console.error('✗ Email send failed:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
  }
}

testEmail();
