# CRITICAL: Backend Domain Does Not Exist

## The Problem

The error `ERR_NAME_NOT_RESOLVED` for `https://api.famousgate.hirall.com/api/system/branches` means:

**The domain `api.famousgate.hirall.com` does NOT exist in DNS.**

The browser literally cannot find this server. It's like calling a phone number that doesn't exist.

## What This Means

You said "backend is already deployed to api.famousgate.hirall.com" but:

1. Either the domain is NOT actually set up
2. Or the DNS records are NOT configured
3. Or you meant a DIFFERENT domain

## How to Check

Open a new browser tab and try to visit:
```
https://api.famousgate.hirall.com/api/system/branches
```

What happens?
- ❌ **"This site can't be reached"** = Domain doesn't exist (current issue)
- ❌ **"404 Not Found"** = Domain exists but endpoint doesn't
- ✅ **JSON data or error message** = Domain exists and backend is working

## Possible Scenarios

### Scenario 1: Domain Doesn't Exist Yet
You need to:
1. Set up the subdomain `api.famousgate.hirall.com` in your DNS provider
2. Point it to your backend server's IP address
3. Wait for DNS propagation (5-30 minutes)

### Scenario 2: Wrong Domain Name
Maybe your backend is actually at:
- `https://api.famousgatehotels.com/api` (different domain)
- `https://famousgate.hirall.com/api` (no api subdomain)
- `https://backend.famousgate.hirall.com/api` (different subdomain)
- Some other URL

### Scenario 3: Backend Not Deployed
Your backend might only be running locally on `localhost:5000`

## Quick Test

Run this command in your terminal to check if the domain exists:

```bash
ping api.famousgate.hirall.com
```

**If it says "could not find host"** = Domain doesn't exist
**If it shows an IP address** = Domain exists, backend might be down

## What To Do Now

1. **Find your ACTUAL backend URL**
   - Where did you deploy your backend? (Render, Heroku, Railway, etc.)
   - What is the actual URL they gave you?

2. **Check your DNS settings**
   - Go to your domain registrar (where you bought famousgate.hirall.com)
   - Check if `api.famousgate.hirall.com` is configured
   - What does it point to?

3. **Test the backend directly**
   - Try visiting the URL in your browser
   - See if you get any response

## Temporary Solution

Until you fix the domain, you can:

1. **Use the direct backend URL** (from your hosting provider)
   - Example: `https://famousgate-backend-abc123.onrender.com/api`
   - Update `landing-page/.env.production` with this URL
   - Update Vercel environment variables
   - Redeploy

2. **Disable dynamic features**
   - Set `NEXT_PUBLIC_ENABLE_BOOKING=false`
   - Set `NEXT_PUBLIC_ENABLE_SEARCH=false`
   - Static pages will work fine

## Questions to Answer

1. **Where is your backend actually deployed?**
   - Render? Heroku? Railway? DigitalOcean? AWS?

2. **What URL did they give you?**
   - When you deployed, what was the URL?

3. **Do you own the domain famousgate.hirall.com?**
   - Can you access the DNS settings?

4. **Have you set up the subdomain api.famousgate.hirall.com?**
   - In your DNS provider?
   - What does it point to?

## Next Steps

Please answer the questions above so I can help you fix this properly.
