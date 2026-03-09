# Landing Page API Error - Action Plan

## Current Issue

The landing page on production (https://famousgatehotels.com) is showing API errors:
```
GET https://api.famousgate.hirall.com/system/branches net::ERR_NAME_NOT_RESOLVED
```

## Root Cause

The backend API is **NOT DEPLOYED YET**. The domain `api.famousgate.hirall.com` doesn't exist, which is why you're getting `ERR_NAME_NOT_RESOLVED`.

## Current Status

✅ Landing page is deployed and live on Vercel
✅ Static pages work perfectly (About, Dining, Events, Hotels)
✅ Backend runs locally on `http://localhost:5000`
❌ Backend is NOT deployed to production
❌ Dynamic features don't work (room search, booking)

## Solution Options

### Option 1: Deploy Backend (Recommended)

Deploy your backend to a hosting service, then update the landing page to use it.

#### Step 1: Choose a Hosting Platform

**Render.com** (Recommended - Free tier available)
- Free tier: 750 hours/month
- Automatic deployments from GitHub
- Easy environment variable management
- PostgreSQL database included

**Railway.app**
- $5/month credit (free trial)
- Very easy setup
- Great for Node.js apps

**Heroku**
- Free tier discontinued, starts at $7/month
- Very reliable
- Easy to use

#### Step 2: Deploy Backend to Render (Example)

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Name: `famousgate-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free

5. Add Environment Variables (from `backend/.env`):
   ```
   PORT=5000
   NODE_ENV=production
   DATABASE_URL=your_supabase_url
   SUPABASE_PROJECT_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_key
   JWT_SECRET=your_secret
   BREVO_API_KEY=your_key
   SMTP_FROM_EMAIL=info@famousgateshotels.com
   LANDING_PAGE_PRODUCTION_URL=https://famousgatehotels.com
   ```

6. Click "Create Web Service"
7. Wait for deployment (5-10 minutes)
8. Get your backend URL (e.g., `https://famousgate-backend.onrender.com`)

#### Step 3: Update Landing Page Configuration

1. Update `landing-page/.env.production`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://famousgate-backend.onrender.com/api
   ```

2. Update Vercel Environment Variables:
   - Go to Vercel project settings
   - Environment Variables section
   - Add: `NEXT_PUBLIC_API_BASE_URL` = `https://famousgate-backend.onrender.com/api`
   - Save

3. Redeploy landing page on Vercel:
   - Go to Vercel dashboard
   - Click "Redeploy" or push a new commit to trigger deployment

### Option 2: Disable Dynamic Features Temporarily

If you don't want to deploy the backend yet, you can disable the dynamic features:

1. Update `landing-page/.env.production`:
   ```env
   NEXT_PUBLIC_ENABLE_BOOKING=false
   NEXT_PUBLIC_ENABLE_SEARCH=false
   ```

2. Update Vercel environment variables with the same values

3. Redeploy

This will hide the room search and booking features, but all static pages will work perfectly.

### Option 3: Use Existing Backend (If You Have One)

If you already have a backend running somewhere:

1. Find your backend URL
2. Update `landing-page/.env.production` with that URL
3. Update Vercel environment variables
4. Redeploy

## Recommended Next Steps

1. **Deploy backend to Render.com** (30 minutes)
   - Follow Step 2 above
   - Get production backend URL

2. **Update landing page configuration** (5 minutes)
   - Update `.env.production`
   - Update Vercel environment variables

3. **Redeploy landing page** (5 minutes)
   - Push changes or trigger manual redeploy

4. **Test** (5 minutes)
   - Visit https://famousgatehotels.com
   - Try room search
   - Try booking

## Files Modified

- `landing-page/.env.production` - Temporarily set to localhost (needs production URL after backend deployment)
- `backend/.env` - Added landing page configuration variables
- `BACKEND_LANDING_PAGE_ENV_SETUP.md` - Complete deployment guide

## What Works Now

✅ All static pages (About, Dining, Events, Hotels)
✅ Navigation
✅ Footer with social media links
✅ SEO optimization
✅ Mobile responsive design

## What Needs Backend

❌ Room availability search
❌ Booking functionality
❌ Hotel branch data
❌ Room type information

## Questions?

- **Q: Can I use the same backend for both the main app and landing page?**
  - A: Yes! The backend already supports both. Just deploy it once.

- **Q: Will this cost money?**
  - A: Render.com has a free tier (750 hours/month). Railway gives $5 credit. Both are enough for testing.

- **Q: How long does deployment take?**
  - A: First deployment: 30-45 minutes. Subsequent deployments: 5-10 minutes.

- **Q: What if I don't want to deploy the backend yet?**
  - A: Use Option 2 above to disable dynamic features. The static site will work perfectly.
