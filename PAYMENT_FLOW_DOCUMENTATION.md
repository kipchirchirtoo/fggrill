# Payment Flow Documentation - M-Pesa & Paystack Integration

## Overview
Complete payment integration for FG Grill Hotel booking system with M-Pesa (mobile money) and Paystack (cards/bank transfers).

---

## 🔧 Configuration

### Environment Variables (`.env`)

```bash
# M-Pesa Configuration (Sandbox)
MPESA_CONSUMER_KEY=U945GtQ9b9ifsSjlw4BewrGRBCWG5z1SAn0RpjkeOhkCRiiv
MPESA_CONSUMER_SECRET=DWKEyqiS8rAYe35JSvLgrT8xRtPI7qD2pEAAza6FD8wv5vGoXF5QMEo8v7UUEhXR
MPESA_ENVIRONMENT=sandbox
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://c8e0023d9d7d.ngrok-free.app/api/payments/mpesa/callback
MPESA_TIMEOUT_URL=https://c8e0023d9d7d.ngrok-free.app/api/payments/mpesa/timeout
MPESA_RESULT_URL=https://c8e0023d9d7d.ngrok-free.app/api/payments/mpesa/result

# Paystack Configuration (Test Mode)
PAYSTACK_SECRET_KEY=sk_test_428e2538c4c039218783274be6193bb41babf122
PAYSTACK_PUBLIC_KEY=pk_test_0e077bc80e3e783be913537d24edda37a0b9cedd
PAYSTACK_WEBHOOK_URL=https://c8e0023d9d7d.ngrok-free.app/api/payments/paystack/webhook
PAYSTACK_CALLBACK_URL=https://c8e0023d9d7d.ngrok-free.app/api/payments/paystack/callback

# Email Configuration (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=96a507001@smtp-brevo.com
SMTP_PASS=xsmtpsib-38bcbdb899aab096feabd5c17c1e566d5c057251501891a77b64bc74ba87ad06-XPa8Pw5mp819KU2E
SMTP_FROM_NAME=FG Grill Hotel
SMTP_FROM_EMAIL=96a507001@smtp-brevo.com

# Frontend URL
FRONTEND_URL=http://localhost:3001
```

---

## 📊 Database Schema

### Payments Table
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    booking_id UUID REFERENCES reservations(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔄 Complete Payment Flow

### 1. M-Pesa Payment Flow

#### Step 1: User Initiates Payment
```
Frontend → POST /api/payments/booking/initiate
{
  "bookingId": "uuid",
  "phoneNumber": "254700000000",
  "amount": 6930,
  "paymentMethod": "mpesa"
}
```

#### Step 2: Backend Initiates STK Push
```javascript
// Backend calls M-Pesa API
mpesaService.stkPush(phoneNumber, amount, reference, description)

// Stores payment record in database
{
  reference: CheckoutRequestID,
  amount: 6930,
  currency: 'KES',
  payment_method: 'mpesa',
  status: 'pending',
  booking_id: bookingId,
  metadata: {
    phoneNumber,
    merchantRequestId,
    checkoutRequestId
  }
}
```

#### Step 3: User Completes Payment on Phone
- User receives STK push prompt on their phone
- User enters M-Pesa PIN
- M-Pesa processes payment

#### Step 4: M-Pesa Sends Callback
```
M-Pesa → POST /api/payments/mpesa/callback
{
  Body: {
    stkCallback: {
      CheckoutRequestID: "ws_CO_xxx",
      ResultCode: "0",
      ResultDesc: "Success",
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 6930 },
          { Name: "MpesaReceiptNumber", Value: "QGX123456" },
          { Name: "PhoneNumber", Value: "254700000000" }
        ]
      }
    }
  }
}
```

#### Step 5: Backend Processes Callback
```javascript
// Update payment status
await supabase.from('payments').update({
  status: 'completed',
  metadata: { ...metadata, mpesaReceiptNumber, transactionDate }
})

// Update booking status
await supabase.from('reservations').update({
  deposit_paid: true,
  deposit_paid_at: new Date()
})

// Send booking confirmation email
await sendBookingConfirmationEmail(bookingId)
```

#### Step 6: Frontend Polls for Status
```javascript
// Frontend polls every 3 seconds
const statusResponse = await fetch(`/api/payments/status/${paymentId}`)

// When status === 'completed'
router.push(`/booking/confirmation?bookingId=${bookingId}`)
```

---

### 2. Paystack Payment Flow

#### Step 1: User Initiates Payment
```
Frontend → POST /api/payments/booking/initiate
{
  "bookingId": "uuid",
  "email": "user@example.com",
  "amount": 6930,
  "paymentMethod": "paystack"
}
```

#### Step 2: Backend Initializes Transaction
```javascript
// Build callback URL
const callbackUrl = `${FRONTEND_URL}/booking/confirmation?bookingId=${bookingId}&reference=${reference}`

// Initialize Paystack transaction
paystackService.initializeTransaction(
  email,
  amount,
  reference,
  { bookingId },
  callbackUrl
)

// Store payment record
{
  reference: paystackResponse.data.reference,
  amount: 6930,
  currency: 'KES',
  payment_method: 'paystack',
  status: 'pending',
  booking_id: bookingId,
  metadata: {
    email,
    authorization_url,
    access_code
  }
}
```

#### Step 3: User Redirected to Paystack
```javascript
// Frontend redirects user
window.location.href = paymentData.data.authorization_url
// User completes payment on Paystack checkout page
```

#### Step 4: Paystack Sends Webhook
```
Paystack → POST /api/payments/paystack/webhook
{
  event: "charge.success",
  data: {
    reference: "FGH-xxx",
    status: "success",
    amount: 693000,
    gateway_response: "Successful",
    paid_at: "2025-12-16T10:30:00.000Z",
    channel: "card"
  }
}
```

#### Step 5: Backend Processes Webhook
```javascript
// Verify transaction with Paystack
const verification = await paystackService.verifyTransaction(reference)

// Update payment status
await supabase.from('payments').update({
  status: 'completed',
  metadata: { ...metadata, gateway_response, paid_at, channel }
})

// Update booking status
await supabase.from('reservations').update({
  deposit_paid: true,
  deposit_paid_at: new Date()
})

// Send booking confirmation email
await sendBookingConfirmationEmail(bookingId)
```

#### Step 6: User Redirected Back
```
Paystack → User's Browser → GET /api/payments/paystack/callback?reference=xxx

Backend redirects to:
${FRONTEND_URL}/booking/confirmation?bookingId=${bookingId}&reference=${reference}
```

---

## 📧 Email Notifications

### Booking Confirmation Email
Automatically sent when payment is successful:

**Triggers:**
- M-Pesa callback with ResultCode = 0
- Paystack webhook with event = "charge.success"
- Paystack payment verification with status = "success"

**Email Content:**
- Booking confirmation number
- Guest name and contact details
- Check-in and check-out dates
- Room type and number
- Number of guests (adults/children)
- Total amount paid
- Payment method
- Special requests

**Template Location:** `/backend/src/utils/emailTemplates.ts`

---

## 🔗 API Endpoints

### Payment Initiation
```
POST /api/payments/booking/initiate
POST /api/payments/mpesa/initiate
POST /api/payments/paystack/initiate
```

### Webhooks & Callbacks
```
POST /api/payments/mpesa/callback
POST /api/payments/mpesa/timeout
POST /api/payments/paystack/webhook
GET  /api/payments/paystack/callback
```

### Payment Status
```
GET /api/payments/status/:paymentId
GET /api/payments/paystack/verify/:reference
```

---

## 🧪 Testing

### Test M-Pesa Payment
```bash
curl -X POST http://localhost:5000/api/payments/mpesa/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254700000000",
    "amount": 6930,
    "bookingId": "your-booking-id"
  }'
```

### Test Paystack Payment
```bash
curl -X POST http://localhost:5000/api/payments/paystack/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "amount": 6930,
    "bookingId": "your-booking-id"
  }'
```

### Test Paystack Cards
- **Success:** 4084084084084081
- **Insufficient Funds:** 5060666666666666666
- **Declined:** 5060000000000000009

---

## 🐛 Troubleshooting

### Issue: Emails Not Sending
**Solution:**
1. Check SMTP credentials in `.env`
2. Test email connection: `GET /api/email/status`
3. Check logs: `tail -f backend/logs/app.log`

### Issue: M-Pesa Callback Not Received
**Solution:**
1. Verify ngrok is running: `ngrok http 5000`
2. Update callback URL in `.env` with new ngrok URL
3. Check M-Pesa sandbox logs

### Issue: Paystack Redirect Not Working
**Solution:**
1. Verify `FRONTEND_URL` in `.env`
2. Check callback URL in Paystack initialization
3. Ensure `/api/payments/paystack/callback` route is accessible

### Issue: Payment Status Not Updating
**Solution:**
1. Check webhook logs in backend
2. Verify database connection
3. Check payment record in `payments` table
4. Verify booking exists in `reservations` table

---

## 🔒 Security Considerations

1. **Webhook Verification:** Implement signature verification for Paystack webhooks
2. **HTTPS Required:** Use HTTPS in production (ngrok provides this)
3. **Environment Variables:** Never commit `.env` file
4. **API Keys:** Rotate keys regularly
5. **Database:** Use prepared statements (Supabase handles this)

---

## 📝 Production Checklist

- [ ] Replace sandbox M-Pesa credentials with production keys
- [ ] Replace test Paystack keys with live keys
- [ ] Update ngrok URL to production domain
- [ ] Configure Paystack webhook signature verification
- [ ] Set up SSL certificate
- [ ] Configure email service for production
- [ ] Test complete flow end-to-end
- [ ] Set up monitoring and alerts
- [ ] Configure backup payment gateway
- [ ] Document customer support procedures

---

## 📞 Support Contacts

- **M-Pesa Support:** developer@safaricom.co.ke
- **Paystack Support:** support@paystack.com
- **Email Service (Brevo):** support@brevo.com

---

## 🎯 Success Metrics

**Payment Flow Working When:**
1. ✅ User can initiate payment
2. ✅ Payment gateway responds with valid transaction ID
3. ✅ Payment record created in database
4. ✅ User completes payment successfully
5. ✅ Webhook/callback received and processed
6. ✅ Payment status updated to 'completed'
7. ✅ Booking status updated (deposit_paid = true)
8. ✅ Confirmation email sent to guest
9. ✅ User redirected to confirmation page
10. ✅ Confirmation page displays booking details

---

**Last Updated:** December 16, 2025
**Version:** 1.0.0
