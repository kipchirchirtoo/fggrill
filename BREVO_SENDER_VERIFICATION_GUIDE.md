# Brevo Sender Email Verification Guide

## Problem
Brevo is rejecting emails because the sender address `info@famousgatehotels.com` is not verified in your Brevo account.

**Error Message:**
```
Sending has been rejected because the sender you used a4238e001@smtp-brevo.com is not valid. 
Validate your sender or authenticate your domain
```

## Solution: Verify Your Sender Email in Brevo

### Step 1: Log into Brevo
1. Go to https://app.brevo.com/
2. Log in with your Brevo account credentials

### Step 2: Add and Verify Sender Email
1. Click on **Settings** (gear icon in top right)
2. Go to **Senders & IP** section
3. Click **Add a Sender**
4. Enter the following details:
   - **Sender Name:** Famous Gates Hotels
   - **Sender Email:** info@famousgatehotels.com
5. Click **Save**

### Step 3: Verify the Email Address
Brevo will send a verification email to `info@famousgatehotels.com`:
1. Check the inbox for `info@famousgatehotels.com`
2. Open the verification email from Brevo
3. Click the verification link
4. Confirm the verification

### Step 4: Wait for Verification to Complete
- Verification usually takes a few minutes
- You'll see a green checkmark next to the email in Brevo dashboard when verified

## Alternative: Use Domain Authentication (Recommended for Production)

For better email deliverability, authenticate your entire domain:

### Step 1: Domain Authentication in Brevo
1. Go to **Settings** → **Senders & IP**
2. Click **Authenticate a domain**
3. Enter your domain: `famousgatehotels.com`
4. Brevo will provide DNS records (SPF, DKIM, DMARC)

### Step 2: Add DNS Records
Add these DNS records to your domain registrar (GoDaddy, Namecheap, etc.):

**Example DNS Records (Brevo will provide exact values):**
```
Type: TXT
Host: @
Value: v=spf1 include:spf.brevo.com ~all

Type: TXT  
Host: mail._domainkey
Value: [DKIM key provided by Brevo]

Type: CNAME
Host: brevo._domainkey
Value: [Value provided by Brevo]
```

### Step 3: Verify Domain in Brevo
1. After adding DNS records, wait 24-48 hours for propagation
2. Return to Brevo and click **Verify Domain**
3. Once verified, ALL emails from `@famousgatehotels.com` will work

## Temporary Workaround: Use a Verified Email

If you can't verify `info@famousgatehotels.com` immediately, use an email that's already verified in your Brevo account.

### Check Which Emails Are Verified
1. Log into Brevo
2. Go to **Settings** → **Senders & IP**
3. Look for emails with a green checkmark ✓

### Common Verified Emails in Brevo Accounts
- The email you used to sign up for Brevo
- Any email you've previously verified

### Update Backend Configuration
If you find a verified email (e.g., `your-verified-email@example.com`), update the backend:

**File:** `backend/.env`
```env
SMTP_FROM_EMAIL=your-verified-email@example.com
```

Then restart the backend server.

## Current Configuration

**Your Brevo SMTP Settings:**
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=96a507001@smtp-brevo.com
SMTP_PASS=xsmtpsib-38bcbdb899aab096feabd5c17c1e566d5c057251501891a77b64bc74ba87ad06-XPa8Pw5mp819KU2E
```

**Desired FROM Address:**
```env
SMTP_FROM_NAME=Famous Gates Hotels
SMTP_FROM_EMAIL=info@famousgatehotels.com
```

## Testing After Verification

Once the email is verified in Brevo:

1. **Update backend/.env:**
```env
SMTP_FROM_EMAIL=info@famousgatehotels.com
```

2. **Restart backend server** (it will auto-restart with nodemon)

3. **Make a test booking** on http://localhost:3001

4. **Check your email inbox** - you should receive the confirmation email from `Famous Gates Hotels <info@famousgatehotels.com>`

## Verification Checklist

- [ ] Log into Brevo dashboard
- [ ] Add `info@famousgatehotels.com` as a sender
- [ ] Check inbox for verification email
- [ ] Click verification link
- [ ] Wait for green checkmark in Brevo dashboard
- [ ] Update `backend/.env` with verified email
- [ ] Restart backend server
- [ ] Test booking flow
- [ ] Confirm email received

## Important Notes

1. **You CANNOT send emails from unverified addresses** - Brevo will reject them
2. **Verification is required for EACH sender email** you want to use
3. **Domain authentication is better** than individual email verification for production
4. **The SMTP_USER is NOT the FROM address** - it's your Brevo API login
5. **FROM address must be verified separately** in Brevo dashboard

## Need Help?

If you're having trouble:
1. Check Brevo's sender verification status in dashboard
2. Make sure you have access to the inbox for `info@famousgatehotels.com`
3. Contact Brevo support if verification email doesn't arrive
4. Consider using domain authentication for better deliverability

## Next Steps

1. **Verify the sender email in Brevo** (follow steps above)
2. **Once verified**, the booking system will work perfectly
3. **Emails will be delivered** to guest inboxes with proper branding

The booking system code is working correctly - it just needs the sender email to be verified in Brevo!
