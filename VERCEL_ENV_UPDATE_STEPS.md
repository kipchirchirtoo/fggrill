# Update Vercel Environment Variables - URGENT

## The Fix

Your backend IS deployed at `api.famousgate.hirall.com`, but Vercel doesn't have the correct environment variable set.

## Steps to Fix (5 minutes)

### 1. Go to Vercel Dashboard
- Visit https://vercel.com/dashboard
- Find your `famousgatehotels` project
- Click on it

### 2. Go to Settings
- Click "Settings" tab at the top
- Click "Environment Variables" in the left sidebar

### 3. Add/Update the Variable

**Variable Name:**
```
NEXT_PUBLIC_API_BASE_URL
```

**Value:**
```
https://api.famousgate.hirall.com/api
```

**Important:** Make sure to select all three environments:
- ✅ Production
- ✅ Preview
- ✅ Development

### 4. Save Changes
- Click "Save"

### 5. Redeploy
- Go to "Deployments" tab
- Find the latest deployment
- Click the three dots (...) menu
- Click "Redeploy"
- Wait 2-3 minutes for deployment to complete

### 6. Test
- Visit https://famousgatehotels.com
- Open browser console (F12)
- The API errors should be gone
- Room search should work
- Booking should work

## Alternative: Quick Redeploy

If you have the Vercel CLI installed:

```bash
cd landing-page
vercel --prod
```

This will redeploy with the new environment variable.

## What Was Wrong?

The error showed:
```
GET https://api.famousgate.hirall.com/system/branches
```

But it should be:
```
GET https://api.famousgate.hirall.com/api/system/branches
```

The `/api` was missing because Vercel was using an old or missing environment variable.

## Files Updated

✅ `landing-page/.env.production` - Updated to correct backend URL
✅ `backend/.env` - Added landing page configuration

## After This Fix

✅ Room search will work
✅ Booking will work
✅ All API calls will succeed
✅ No more ERR_NAME_NOT_RESOLVED errors

## Need Help?

If you still see errors after redeploying:

1. Check browser console for the exact URL being called
2. Make sure your backend at `api.famousgate.hirall.com` is running
3. Test the backend directly: `https://api.famousgate.hirall.com/api/system/branches`
4. Check CORS settings in your backend to allow `https://famousgatehotels.com`
