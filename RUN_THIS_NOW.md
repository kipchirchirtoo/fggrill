# 📧 Send Test Email - Ready to Run!

## Email configured for: allansamuel571@gmail.com

## Step 1: Make Sure Services Are Running

### Terminal 1 - Python Service
```bash
cd python-services
python barcode_app.py
```

Wait for:
```
Starting Barcode & PDF Service on port 5001
Available endpoints:
  - POST /api/barcode/generate
  - POST /api/reports/generate/branded-pdf
```

### Terminal 2 - Backend
```bash
cd backend
npm run dev
```

Wait for backend to compile successfully.

## Step 2: Send Test Email

### Terminal 3
```bash
cd backend
node send-one-test-email.js
```

## Expected Output

```
📧 Sending Test Email with PDF Attachment

============================================================

📋 Test Booking Details:
   Guest: Allan Samuel
   Email: allansamuel571@gmail.com
   Confirmation: HTL1709740800000
   Check-in: March 15, 2026
   Check-out: March 20, 2026
   Room: Deluxe Room
   Guests: 2
   Amount: KES 15,000

============================================================

🚀 Sending email via backend API...

✅ SUCCESS! Email sent successfully!
```

## Step 3: Check Your Email

Check **allansamuel571@gmail.com** inbox for:

### Email Subject
`Booking Confirmation - HTL[number] - Famous Gate Hotel Bomet`

### Email Content
- Professional document-style design
- FamousGate Hotels header with logo
- Phone: +254 706 782 828 (correct number)
- All booking details
- Barcode with confirmation number

### PDF Attachment
- File: `invoice_HTL[number].pdf`
- Professional invoice layout
- Guest information
- Reservation details
- Payment summary
- Contact info with correct phone

## If Something Goes Wrong

### Error: "Cannot connect to backend"
```bash
# Start backend
cd backend
npm run dev
```

### Error: "Failed to generate PDF"
```bash
# Start Python service
cd python-services
python barcode_app.py
```

### Email not received
1. Check spam/junk folder
2. Wait 2-3 minutes
3. Check backend logs for errors
4. Verify BREVO_API_KEY in .env

## Quick Status Check

Before running, verify:
- [ ] Python service running (port 5001)
- [ ] Backend running (port 5000)
- [ ] BREVO_API_KEY in .env file

## Ready? Run This Command:

```bash
cd backend && node send-one-test-email.js
```

That's it! Check your email in 1-2 minutes.
