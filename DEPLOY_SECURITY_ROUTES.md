# Deploy Security Routes to Production

## Status: Ready for Deployment ✅

All security dashboard functionality has been implemented with real API calls. The backend routes are complete and tested locally, but need to be deployed to the production server at `api.hirall.com`.

## What's Been Implemented

### Backend (Complete ✅)
- ✅ Security controller with all endpoints (`backend/src/controllers/security.controller.ts`)
- ✅ Security routes registered (`backend/src/routes/security.routes.ts`)
- ✅ Routes integrated into main router (`backend/src/routes/index.ts`)
- ✅ Database migration applied (`backend/supabase/migrations/71_security_management_tables.sql`)
- ✅ All code committed to repository

### Frontend (Complete ✅)
- ✅ Security API client (`frontend/src/lib/api/security.ts`)
- ✅ All dashboard components using real API calls
- ✅ Loading states, error handling, and toast notifications
- ✅ All 8 tabs functional with backend integration

## Deployment Steps

### Option 1: Quick Restart (If Code is Already on Server)

If you've already pulled the latest code to the production server:

```bash
# SSH into production server
ssh user@api.hirall.com

# Navigate to backend directory
cd /path/to/backend

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Build TypeScript
npm run build

# Restart PM2 process
pm2 restart famous-gate-hotel

# Check logs
pm2 logs famous-gate-hotel --lines 50
```

### Option 2: Full Deployment Script

If you need to deploy from scratch:

```bash
# Set environment variables
export DEPLOY_HOST="api.hirall.com"
export DEPLOY_USER="your-username"
export DEPLOY_PATH="/path/to/backend"

# Run deployment script
cd backend
./scripts/deploy.sh
```

### Option 3: Manual Deployment

1. **Build locally:**
   ```bash
   cd backend
   npm run build
   ```

2. **Upload to server:**
   ```bash
   scp -r dist/ user@api.hirall.com:/path/to/backend/
   ```

3. **SSH and restart:**
   ```bash
   ssh user@api.hirall.com
   cd /path/to/backend
   pm2 restart famous-gate-hotel
   ```

## Verification

After deployment, verify the security endpoints are accessible:

### 1. Check Server Health
```bash
curl https://api.hirall.com/api/health
```

### 2. Test Security Config Endpoint
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.hirall.com/api/security/config
```

### 3. Check Frontend
- Navigate to: `https://your-frontend.com/dashboard/super/admin/security`
- All 8 tabs should load without 404 errors
- Data should populate from real API calls

## Security Endpoints Available

All endpoints require super admin authentication:

- `GET /api/security/config` - Get security configuration
- `PUT /api/security/config` - Update security configuration
- `GET /api/security/rls-policies` - Get RLS policies status
- `GET /api/security/api-metrics` - Get API security metrics
- `GET /api/security/blocked-ips` - Get blocked IP addresses
- `POST /api/security/block-ip` - Block an IP address
- `POST /api/security/unblock-ip` - Unblock an IP address
- `GET /api/security/active-sessions` - Get active user sessions
- `POST /api/security/terminate-session` - Terminate a user session
- `POST /api/security/terminate-all-sessions` - Terminate all sessions

## Troubleshooting

### 404 Errors on Security Endpoints

**Cause:** Backend server hasn't been restarted with new routes

**Solution:**
```bash
pm2 restart famous-gate-hotel
pm2 logs famous-gate-hotel
```

### TypeScript Build Errors

**Cause:** Outdated dependencies or cache issues

**Solution:**
```bash
rm -rf dist node_modules
npm install
npm run build
```

### PM2 Process Not Found

**Cause:** PM2 process name mismatch

**Solution:**
```bash
# List all PM2 processes
pm2 list

# Start with correct name
pm2 start dist/server.js --name famous-gate-hotel

# Save PM2 configuration
pm2 save
```

## Post-Deployment Checklist

- [ ] Backend server restarted successfully
- [ ] Health check endpoint returns 200 OK
- [ ] Security config endpoint returns data (not 404)
- [ ] Frontend security dashboard loads without errors
- [ ] All 8 tabs display data correctly
- [ ] No console errors in browser
- [ ] Toast notifications work for actions
- [ ] Session termination works
- [ ] IP blocking works

## Rollback Plan

If deployment causes issues:

```bash
# SSH into server
ssh user@api.hirall.com

# Restore previous backup
cd /path/to/backend
mv current current_failed
mv backup_YYYYMMDD_HHMMSS current

# Restart with old version
pm2 restart famous-gate-hotel
```

## Next Steps After Deployment

1. Test all security dashboard features end-to-end
2. Monitor PM2 logs for any errors
3. Verify RLS policies are being enforced
4. Test rate limiting on API endpoints
5. Confirm audit logging is working

## Support

If you encounter issues during deployment:
1. Check PM2 logs: `pm2 logs famous-gate-hotel`
2. Check server logs: `tail -f /path/to/backend/logs/error.log`
3. Verify environment variables are set correctly
4. Ensure database migration 71 was applied successfully
