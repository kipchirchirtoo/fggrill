# CORS Fix - Deployment Instructions

## Problem Summary
CORS errors blocking `famousgate.hirall.com` → `api.hirall.com` due to:
1. **Cold start CORS failure** - Render responds before middleware loads
2. **Duplicate conference hall jobs** - Same job firing twice
3. **Duplicate notification polling** - Two components polling same endpoint
4. **Aggressive polling** - 30-second intervals causing constant load

## Fixes Applied

### ✅ Fix 1: Health Endpoint + Keep-Alive (Prevents Cold Start CORS)

**Backend Changes:**
- Added `/health` endpoint as FIRST route (before all middleware)
- Added explicit `app.options('*', cors())` to handle preflight requests
- Added self-ping mechanism (10-minute intervals in production)

**Files Modified:**
- `backend/src/server.ts` - Health endpoint + OPTIONS handler
- `backend/src/services/startup.service.ts` - Keep-alive ping

**Verification:**
```bash
curl https://api.hirall.com/health
# Should return: {"ok":true,"timestamp":"..."}
```

### ✅ Fix 2: Stop Duplicate Conference Hall Jobs

**Backend Changes:**
- Added duplicate initialization check in `schedulerService.startAll()`
- Prevents job from registering twice if called multiple times

**Files Modified:**
- `backend/src/services/scheduler.service.ts`

**Verification:**
Check logs after deployment - should see:
```
Running conference hall status update
```
Only ONCE per 15-minute interval (not twice)

### ✅ Fix 3: Fix Duplicate Notification Polling

**Frontend Changes:**
- Reduced polling from 30s → 2 minutes in BOTH components:
  - `dashboard-layout.tsx` (unread count badge)
  - `NotificationListener.tsx` (browser notifications)

**Files Modified:**
- `frontend/src/components/layout/dashboard-layout.tsx`
- `frontend/src/components/notifications/NotificationListener.tsx`

**Verification:**
Check browser Network tab - `/api/notifications/unread-count` should fire every 2 minutes (not every 30s)

### ✅ Fix 4: Render Configuration

**Required Render Settings:**

1. **Health Check Path:** `/health`
   - Go to Render Dashboard → Your Service → Settings
   - Set "Health Check Path" to `/health`

2. **Environment Variables:**
   Verify these are set:
   ```
   FRONTEND_URL=https://famousgate.hirall.com
   NODE_ENV=production
   API_URL=https://api.hirall.com
   ```

## Deployment Steps

### Backend Deployment (Render)

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Fix: CORS cold start + duplicate jobs + aggressive polling"
   git push origin main
   ```

2. **Render will auto-deploy** (if auto-deploy enabled)
   - Or manually trigger deploy in Render dashboard

3. **Configure Health Check:**
   - Render Dashboard → Service → Settings
   - Health Check Path: `/health`
   - Save changes

4. **Verify deployment:**
   ```bash
   # Test health endpoint
   curl https://api.hirall.com/health
   
   # Test CORS headers
   curl -I -X OPTIONS https://api.hirall.com/api/auth/login \
     -H "Origin: https://famousgate.hirall.com" \
     -H "Access-Control-Request-Method: POST"
   
   # Should see: Access-Control-Allow-Origin: https://famousgate.hirall.com
   ```

### Frontend Deployment (Vercel)

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Fix: Reduce notification polling to 2 minutes"
   git push origin main
   ```

2. **Vercel will auto-deploy**

3. **Verify:**
   - Open browser DevTools → Network tab
   - Login to `https://famousgate.hirall.com`
   - Watch for `/api/notifications/unread-count` calls
   - Should occur every 2 minutes (not 30 seconds)

## Post-Deployment Verification

### 1. Test Cold Start CORS
```bash
# Wait 30 minutes for Render to potentially sleep
# Then try logging in - should work immediately
```

### 2. Check Logs for Duplicate Jobs
```bash
# In Render logs, search for "conference hall status update"
# Should appear once per 15 minutes, not twice
```

### 3. Monitor API Response Times
```bash
# Check Render metrics dashboard
# Response times should be < 300ms after warm-up
```

### 4. Verify Notification Polling
```bash
# Browser DevTools → Network tab
# Filter: "unread-count"
# Should see requests every 2 minutes from BOTH:
#   - dashboard-layout (badge update)
#   - NotificationListener (browser notifications)
# Total: 2 requests per 2 minutes (not 2 per 30 seconds)
```

## Expected Results

✅ **Login works immediately** after inactivity (no CORS error)  
✅ **Conference hall job fires once** per interval  
✅ **Notification polling reduced** from 120 req/hour → 30 req/hour per user  
✅ **API response times** < 300ms after warm-up  
✅ **No duplicate API calls** in logs  

## Rollback Plan

If issues occur:

1. **Backend rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Frontend rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

## Monitoring

After deployment, monitor for 24 hours:

- **Render logs:** No CORS errors, no duplicate jobs
- **Browser console:** No CORS errors on login
- **API metrics:** Response times stable
- **User reports:** Login works consistently

## Notes

- Keep-alive ping only runs in production (disabled in development)
- Health endpoint responds before CORS middleware (intentional)
- Notification polling reduced but still provides real-time feel (2 min)
- Conference hall job protected against duplicate initialization

---

**Deployment Date:** _[Fill in after deployment]_  
**Deployed By:** _[Fill in]_  
**Verification Status:** _[Fill in after verification]_
