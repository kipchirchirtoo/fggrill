require('dotenv').config();
const nodemailer = require('nodemailer');

const testSMTP = async () => {
    console.log('--- SMTP Direct Connection Test ---');
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`User: ${process.env.SMTP_USER}`);
    console.log(`From: ${process.env.SMTP_FROM_EMAIL}`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('✅ SMTP Connection verified successfully!');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'FG Grill'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: 'kipchirchirtoo01@gmail.com',
            subject: 'SMTP Direct Test',
            text: 'This is a test email sent directly from the SMTP test script.',
            html: '<b>This is a test email sent directly from the SMTP test script.</b>'
        });
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ SMTP Test Failed:');
        console.error(error);
    }
};

testSMTP();
