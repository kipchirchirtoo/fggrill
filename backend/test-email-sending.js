/**
 * Test Email Sending with Brevo
 * 
 * This script tests if emails can be sent successfully from info@famousgatehotels.com
 */

const nodemailer = require('nodemailer');
require('dotenv').config({ path: './.env' });

async function testEmailSending() {
  console.log('🧪 Testing Email Configuration...\n');
  
  // Display current configuration
  console.log('📧 Email Configuration:');
  console.log(`   SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`   SMTP User: ${process.env.SMTP_USER}`);
  console.log(`   FROM Name: ${process.env.SMTP_FROM_NAME}`);
  console.log(`   FROM Email: ${process.env.SMTP_FROM_EMAIL}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Test connection
  console.log('🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    process.exit(1);
  }

  // Send test email
  console.log('📨 Sending test email...');
  const testEmail = {
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
    to: 'kipchirchirtoo01@gmail.com', // Test recipient
    subject: 'Test Email from Famous Gates Hotels',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d4af37;">Email Test Successful!</h1>
        <p>This is a test email from Famous Gates Hotels booking system.</p>
        <p><strong>FROM:</strong> ${process.env.SMTP_FROM_NAME} &lt;${process.env.SMTP_FROM_EMAIL}&gt;</p>
        <p><strong>SMTP Server:</strong> ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <hr style="border: 1px solid #d4af37; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          If you received this email, it means the email configuration is working correctly!
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    
    console.log('🎉 Email system is working correctly!');
    console.log('📬 Check the inbox for kipchirchirtoo01@gmail.com\n');
  } catch (error) {
    console.error('❌ Failed to send test email:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   SMTP Response: ${error.response}`);
    }
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting email test...\n');
testEmailSending()
  .then(() => {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
