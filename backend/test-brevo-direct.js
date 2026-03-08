/**
 * Test Brevo API Directly (No Backend Required)
 * 
 * This script tests the Brevo API directly without needing the backend server
 */

const { BrevoClient } = require('@getbrevo/brevo');
require('dotenv').config({ path: './.env' });

async function testBrevoDirectly() {
  try {
    console.log('🧪 Testing Brevo API Directly\n');
    
    const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'info@famousgatehotels.com';
    const fromName = process.env.SMTP_FROM_NAME || 'FamousGate Hotels';
    
    console.log('📋 Configuration:');
    console.log(`   API Key: ${apiKey?.substring(0, 20)}...`);
    console.log(`   FROM: ${fromName} <${fromEmail}>`);
    console.log();

    // Initialize Brevo client
    const client = new BrevoClient({ apiKey });

    const emailData = {
      sender: {
        name: fromName,
        email: fromEmail
      },
      to: [{
        email: 'kipchirchirtoo01@gmail.com',
        name: 'Allan Kipchirchir'
      }],
      subject: 'Test Email from Brevo API - FamousGate Hotels',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 32px;">FamousGate Hotels</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">Test Email via Brevo API</p>
            </div>
            
            <div class="content">
              <h2>✅ Success!</h2>
              <p>This is a test email sent directly via the Brevo API.</p>
              <p>If you're reading this, the Brevo API integration is working correctly!</p>
              <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    console.log('📧 Sending test email via Brevo API...');
    console.log('   To: kipchirchirtoo01@gmail.com');
    console.log('   Subject: Test Email from Brevo API - FamousGate Hotels');
    console.log();

    const result = await client.transactionalEmails.sendTransacEmail(emailData);
    
    console.log('✅ Email sent successfully via Brevo API!');
    console.log('   Message ID:', result.messageId);
    console.log();
    console.log('📬 Check the inbox for: kipchirchirtoo01@gmail.com');
    console.log('   FROM: FamousGate Hotels <info@famousgatehotels.com>');
    console.log();
    console.log('🎉 Brevo API is working correctly!');

  } catch (error) {
    console.error('❌ Error sending email via Brevo API:', error.message);
    if (error.body) {
      console.error('   Error body:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting Brevo API direct test...\n');
testBrevoDirectly()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
