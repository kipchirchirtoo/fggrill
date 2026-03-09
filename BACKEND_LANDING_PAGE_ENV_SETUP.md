# Backend Environment Variables for Landing Page

## Overview
Your backend needs to support both the main app (frontend) and the landing page. Here's how to configure it.

## Local Development (.env file)

Your `backend/.env` file now includes:

```env
# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001

# Landing Page Configuration
LANDING_PAGE_URL=http://localhost:3000
LANDING_PAGE_PRODUCTION_URL=https://famousgatehotels.com
```

## Production Deployment

When you deploy your backend to production (Render, Heroku, Railway, etc.), add these environment variables:

### Required Variables for Landing Page Support:

1. **LANDING_PAGE_URL** (for development/testing)
   - Value: `http://localhost:3000`
   - Purpose: CORS configuration for local testing

2. **LANDING_PAGE_PRODUCTION_URL** (for production)
   - Value: `https://famousgatehotels.com`
   - Purpose: CORS configuration for production landing page

3. **BREVO_API_KEY** (already configured)
   - Value: `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`
   - Purpose: Send booking confirmation emails

4. **SMTP_FROM_EMAIL** (already configured)
   - Value: `info@famousgatehotels.com`
   - Purpose: Sender email for booking confirmations

5. **SMTP_FROM_NAME** (already configured)
   - Value: `FamousGate Hotels`
   - Purpose: Sender name for booking confirmations

## How to Set Environment Variables in Your Hosting Platform

### Render.com
1. Go to your backend service dashboard
2. Click "Environment" in the left sidebar
3. Click "Add Environment Variable"
4. Add each variable with its value
5. Click "Save Changes"
6. Render will automatically redeploy

### Heroku
```bash
heroku config:set LANDING_PAGE_URL=http://localhost:3000 -a your-app-name
heroku config:set LANDING_PAGE_PRODUCTION_URL=https://famousgatehotels.com -a your-app-name
```

### Railway
1. Go to your project
2. Click on your backend service
3. Go to "Variables" tab
4. Click "New Variable"
5. Add each variable
6. Railway will automatically redeploy

### Vercel (if using Vercel for backend)
1. Go to your project settings
2. Click "Environment Variables"
3. Add each variable for Production, Preview, and Development
4. Redeploy

## CORS Configuration

Your backend needs to allow requests from the landing page. Update your CORS configuration to include:

```typescript
// In your backend CORS setup
const allowedOrigins = [
  process.env.FRONTEND_URL,                    // Main app
  process.env.LANDING_PAGE_URL,                // Landing page (dev)
  process.env.LANDING_PAGE_PRODUCTION_URL,     // Landing page (prod)
  'http://localhost:3000',                     // Fallback for dev
  'http://localhost:3001',                     // Fallback for main app
];
```

## After Backend Deployment

Once your backend is deployed and you have the production URL:

1. **Update Landing Page Production Environment**
   - File: `landing-page/.env.production`
   - Change: `NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com/api`
   - Example: `NEXT_PUBLIC_API_BASE_URL=https://famousgate-backend.onrender.com/api`

2. **Update Vercel Environment Variables**
   - Go to Vercel project settings
   - Environment Variables section
   - Add/Update: `NEXT_PUBLIC_API_BASE_URL` with your production backend URL
   - Redeploy the landing page

## Testing

After deployment, test these endpoints:

1. **Health Check**
   ```bash
   curl https://your-backend-url.com/api/health
   ```

2. **Branches (for room search)**
   ```bash
   curl https://your-backend-url.com/api/system/branches
   ```

3. **Room Types**
   ```bash
   curl https://your-backend-url.com/api/room-types
   ```

## Current Status

✅ Backend `.env` file updated with landing page variables
✅ Email configuration already set up (Brevo)
⏳ Backend needs to be deployed to production
⏳ Production URL needs to be added to `landing-page/.env.production`
⏳ Vercel environment variables need to be updated

## Next Steps

1. Deploy your backend to a hosting service (Render, Heroku, Railway)
2. Add the environment variables listed above to your hosting platform
3. Get your production backend URL (e.g., `https://your-app.onrender.com`)
4. Update `landing-page/.env.production` with the production backend URL
5. Update Vercel environment variables with the production backend URL
6. Redeploy the landing page on Vercel
