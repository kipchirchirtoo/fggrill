# Diagnose and Fix Email Issue

## Run This Command First

```bash
cd backend
node diagnose-email-issue.js
```

This will check:
1. ✅ Environment variables (BREVO_API_KEY)
2. ✅ Python service (port 5001)
3. ✅ Backend service (port 5000)
4. ✅ Email endpoint
5. ✅ Send test email

## Common Issues and Fixes

### Issue 1: Backend Not Running
**Symptom**: "Cannot connect to backend"

**Fix**:
```bash
cd backend
npm run dev
```

Wait for: "Server running on port 5000"

### Issue 2: Python Service Not Running
**Symptom**: "Failed to generate PDF invoice"

**Fix**:
```bash
cd python-services
python barcode_app.py
```

Wait for: "Starting Barcode & PDF Service on port 5001"

### Issue 3: BREVO_API_KEY Missing
**Symptom**: "BREVO_API_KEY not found"

**Fix**: Add to `.env` file:
```
BREVO_API_KEY=your_actual_api_key_here
```

### Issue 4: Sender Email Not Verified
**Symptom**: Email sends but not received

**Fix**:
1. Go to Brevo dashboard
2. Verify sender email: info@famousgatehotels.com
3. Check email verification status

### Issue 5: 404 Error
**Symptom**: "Cannot POST /api/landing-email/confirmation"

**Fix**: Backend needs restart
```bash
cd backend
# Stop current process (Ctrl+C)
npm run dev
```

### Issue 6: TypeScript Compilation Error
**Symptom**: Backend won't start, compilation errors

**Fix**:
```bash
cd backend
npm run build
npm run dev
```

## Step-by-Step Manual Test

If diagnosis script doesn't work, try manual steps:

### 1. Check Backend is Running
```bash
curl http://localhost:5000/health
```

Should return: `{"status":"ok"}`

### 2. Check Python Service
```bash
curl http://localhost:5001/health
```

Should return health status

### 3. Test PDF Generation
```bash
curl -X POST http://localhost:5001/api/reports/generate/branded-pdf \
  -H "Content-Type: application/json" \
  -d '{"confirmationNumber":"TEST","guestName":"Test","totalAmount":1000}' \
  --output test.pdf
```

Should create test.pdf file

### 4. Test Email Endpoint Directly
```bash
curl -X POST http://localhost:5000/api/landing-email/confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"Allan",
    "lastName":"Samuel",
    "email":"allansamuel571@gmail.com",
    "phone":"+254 706 782 828",
    "confirmationNumber":"HTL123456",
    "checkInDate":"March 15, 2026",
    "checkOutDate":"March 20, 2026",
    "roomType":"Deluxe Room",
    "guests":2,
    "totalAmount":15000,
    "branchName":"Famous Gate Hotel Bomet"
  }'
```

Should return: `{"success":true,"message":"Booking confirmation email sent successfully via Brevo API"}`

## Check Backend Logs

Look for these messages in backend terminal:

**Success**:
```
📧 Landing page booking confirmation request received
Guest: Allan Samuel
Email: allansamuel571@gmail.com
Confirmation: HTL123456
📄 Fetching PDF invoice from Python service...
✅ PDF invoice generated successfully
Sending email via Brevo API to allansamuel571@gmail.com
✅ Email sent successfully via Brevo API
```

**Failure - Python Service Down**:
```
📧 Landing page booking confirmation request received
📄 Fetching PDF invoice from Python service...
⚠️ Failed to generate PDF invoice: connect ECONNREFUSED
Continuing to send email without PDF attachment
```

**Failure - Brevo API Error**:
```
❌ Error sending email via Brevo API
Error details: { message: '...' }
```

## Quick Fix Commands

Run all services:
```bash
# Terminal 1 - Python
cd python-services && python barcode_app.py

# Terminal 2 - Backend
cd backend && npm run dev

# Terminal 3 - Test
cd backend && node diagnose-email-issue.js
```

## Still Not Working?

1. Check `.env` file exists in backend folder
2. Verify BREVO_API_KEY is correct
3. Check Brevo dashboard for API status
4. Try sending email from Brevo dashboard directly
5. Check spam/junk folder for test emails
6. Verify sender email domain is verified in Brevo

## Get Detailed Logs

Add this to backend terminal to see all logs:
```bash
cd backend
DEBUG=* npm run dev
```

Then run test again and check output.
