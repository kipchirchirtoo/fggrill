# Backend Deployment Required

## Issue
The frontend is getting 404 errors when calling `/api/cashier/shifts/start` because the backend server hasn't been restarted with the new shift logbook routes.

## What's Happening
- ✅ Code is committed and pushed to GitHub
- ✅ Routes are registered in `backend/src/routes/index.ts` (line 121)
- ✅ Controller exists: `backend/src/controllers/cashier-shifts.controller.ts`
- ❌ Backend server hasn't reloaded the new code

## Solution

### Option 1: Trigger Manual Redeploy (Recommended)
1. Go to your backend hosting platform (Render/Heroku/etc.)
2. Find the backend service
3. Click "Manual Deploy" or "Redeploy"
4. Wait for deployment to complete (~2-3 minutes)

### Option 2: Push a Small Change
If auto-deploy is enabled, push any small change to trigger redeploy:
```bash
# Add a comment to trigger redeploy
echo "# Trigger redeploy" >> backend/README.md
git add backend/README.md
git commit -m "chore: trigger backend redeploy"
git push origin main
```

### Option 3: Restart Server (if you have access)
If you have direct server access:
```bash
pm2 restart backend
# or
systemctl restart your-backend-service
```

## Verification
Once redeployed, test the endpoint:
```bash
curl https://api.hirall.com/api/cashier/shifts
```

You should get a response instead of 404.

## Routes Added
- `POST /api/cashier/shifts/start` - Start new shift
- `GET /api/cashier/shifts` - List shifts
- `PUT /api/cashier/shifts/:id/close` - Close shift
- `PUT /api/cashier/shifts/:id/reconcile` - Reconcile shift (Accountant)
- `PUT /api/cashier/shifts/:id/verify` - Verify shift (Auditor)
