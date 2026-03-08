# Send Test Email with PDF - Quick Guide

## Quick Steps

### 1. Update Email Address
Open `backend/send-one-test-email.js` and change this line:
```javascript
email: 'your-email@example.com', // CHANGE THIS TO YOUR EMAIL
```

To your actual email:
```javascript
email: 'youremail@gmail.com', // Your real email here
```

### 2. Make Sure Services Are Running

**Terminal 1 - Python Service** (if not already running):
```bash
cd python-services
python barcode_app.py
```

**Terminal 2 - Backend** (if not already running):
```bash
cd backend
npm run dev
```

### 3. Send Test Email

**Terminal 3**:
```bash
cd backend
node send-one-test-email.js
```

## What You'll See

```
📧 Sending Test Email with PDF Attachment

============================================================

📋 Test Booking Details:
   Guest: John Doe
   Email: youremail@gmail.com
   Confirmation: HTL1709740800000
   Check-in: March 15, 2026
   Check-out: March 20, 2026
   Room: Deluxe Room
   Guests: 2
   Amount: KES 15,000

============================================================

🚀 Sending email via backend API...

✅ SUCCESS! Email sent successfully!

Response: { message: 'Booking confirmation email sent successfully' }

============================================================

📬 Check your inbox:
   Email: youremail@gmail.com
   Subject: Booking Confirmation - HTL1709740800000

✓ What to verify:
   1. Email received with professional document design
   2. Phone number shows: +254 706 782 828
   3. PDF invoice is attached
   4. PDF opens and shows all booking details
   5. All information is correct

============================================================
```

## What to Check in Email

### Email Content
- ✅ Professional document-style design (not iOS card style)
- ✅ FamousGate Hotels header with logo
- ✅ Phone number: +254 706 782 828 (in header and footer)
- ✅ All booking details displayed correctly
- ✅ Barcode with confirmation number
- ✅ Check-in information
- ✅ Hotel amenities list

### PDF Attachment
- ✅ File attached: `invoice_HTL[number].pdf`
- ✅ PDF opens successfully
- ✅ Professional invoice layout
- ✅ Guest information section
- ✅ Reservation details section
- ✅ Payment summary with gold border
- ✅ Contact information footer
- ✅ Phone number: +254 706 782 828

## Troubleshooting

### "Cannot connect to backend"
**Solution**: Start backend service
```bash
cd backend
npm run dev
```

### "Failed to generate PDF invoice"
**Solution**: Start Python service
```bash
cd python-services
python barcode_app.py
```

### "Email not received"
**Check**:
1. Spam/junk folder
2. Email address is correct
3. Brevo API key is valid in `.env`
4. Sender email is verified in Brevo dashboard

### "PDF not attached"
**Check backend logs** for:
```
📄 Fetching PDF invoice from Python service...
✅ PDF invoice generated successfully
```

If you see:
```
⚠️ Failed to generate PDF invoice
```

Then Python service is not running or not accessible.

## Alternative: Use Existing Script

If you want to resend emails to all existing bookings:
```bash
cd backend
node resend-bookings-brevo.js
```

This will send emails to all bookings in the database.

## Status Check

Before sending, verify:
- [ ] Python service running on port 5001
- [ ] Backend running on port 5000
- [ ] Email address updated in script
- [ ] BREVO_API_KEY in .env file
- [ ] Sender email verified in Brevo

## Success Criteria

✅ Email received within 1-2 minutes
✅ Professional document design
✅ Correct phone number (+254 706 782 828)
✅ PDF invoice attached
✅ PDF opens and displays correctly
✅ All booking details accurate

## Next Steps After Success

1. Test from landing page with real booking
2. Verify production environment setup
3. Deploy to production when ready

---

**Need Help?**
- Check backend logs for errors
- Check Python service logs for PDF generation errors
- Verify Brevo API dashboard for email status
