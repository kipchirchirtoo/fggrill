# 🚨 RESTART PRODUCTION BACKEND NOW

## Problem
Database passwords are updated but the backend server at `https://api.hirall.com` is still using old cached connections or hasn't picked up the changes.

## Test Results
All login attempts return: `401 Unauthorized - Invalid credentials`

This means:
- ✅ Database has correct passwords
- ❌ Backend server needs restart

## IMMEDIATE ACTION REQUIRED

### Option 1: If Using PM2 (Most Common)
```bash
# SSH into production server
ssh your-production-server

# Restart backend
pm2 restart backend

# Or restart all
pm2 restart all

# Check status
pm2 status

# View logs
pm2 logs backend --lines 50
```

### Option 2: If Using Docker
```bash
# SSH into production server
ssh your-production-server

# Restart backend container
docker restart backend

# Or restart all containers
docker-compose restart

# Check logs
docker logs backend -f
```

### Option 3: If Using Systemd
```bash
# SSH into production server
ssh your-production-server

# Restart service
sudo systemctl restart backend

# Check status
sudo systemctl status backend

# View logs
sudo journalctl -u backend -f
```

### Option 4: If Using Node Directly
```bash
# SSH into production server
ssh your-production-server

# Find and kill the process
pkill -f "node.*server"

# Or find PID and kill
ps aux | grep node
kill -9 <PID>

# Restart
cd /path/to/backend
npm start

# Or with PM2
pm2 start npm --name "backend" -- start
```

### Option 5: If Using Vercel/Netlify/Cloud Platform
```bash
# Trigger a new deployment
# Or use the platform's dashboard to restart

# Vercel
vercel --prod

# Netlify
netlify deploy --prod

# Heroku
heroku restart -a your-app-name
```

## After Restart

### 1. Wait 30 seconds for server to start

### 2. Test login immediately
```bash
node test-production-login.js
```

Should see:
```
✅ LOGIN SUCCESS
   User: Manager Name
   Role: manager
   Token: eyJhbGciOiJIUzI1NiIs...
```

### 3. Test in browser
- Go to your production login page
- Email: `manager@famousgate.com`
- Password: `Allan@13900`
- Should login successfully

## If Still Failing After Restart

### Check Backend Logs
```bash
# PM2
pm2 logs backend --lines 100

# Docker
docker logs backend --tail 100

# Systemd
sudo journalctl -u backend -n 100

# Direct
tail -f /path/to/backend/logs/combined.log
```

Look for:
- Database connection errors
- Authentication errors
- Supabase connection issues

### Check Backend Environment
```bash
# SSH into production
ssh your-production-server

# Check .env file
cd /path/to/backend
cat .env | grep DATABASE_URL

# Should show:
# DATABASE_URL=postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@...
```

### Check Backend is Running
```bash
# Check if process is running
ps aux | grep node

# Check if port is listening
netstat -tlnp | grep 5000

# Test backend directly
curl https://api.hirall.com/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'

# Should return 400 or 401, not connection error
```

## Common Issues

### Issue 1: Backend Not Starting
**Symptoms:** Server crashes immediately after restart

**Fix:**
```bash
# Check for syntax errors
cd /path/to/backend
npm run build

# Check for missing dependencies
npm install

# Check for port conflicts
lsof -i :5000
```

### Issue 2: Database Connection Failed
**Symptoms:** Backend logs show "connection refused" or "authentication failed"

**Fix:**
```bash
# Verify DATABASE_URL in .env
# Make sure password is URL-encoded: Allan@13900 → Allan%4013900

# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'your-service-role-key'
);
supabase.from('users').select('count').then(console.log);
"
```

### Issue 3: Old Code Deployed
**Symptoms:** Backend is running but using old authentication logic

**Fix:**
```bash
# Pull latest code
git pull origin main

# Rebuild
npm run build

# Restart
pm2 restart backend
```

## Production Server Access

If you don't have SSH access to production:
1. Contact your DevOps team
2. Use your cloud platform's dashboard (AWS, Azure, GCP, etc.)
3. Use your deployment platform (Vercel, Netlify, Heroku, etc.)

## Emergency Contact

If you can't restart the backend:
- Contact your hosting provider
- Check your deployment platform dashboard
- Review your CI/CD pipeline

## Verification Checklist

After restart, verify:
- [ ] Backend process is running
- [ ] Backend responds to health check
- [ ] Login works via API test
- [ ] Login works in browser
- [ ] All 15 users can login
- [ ] No errors in backend logs

---

**RESTART THE BACKEND NOW. Every minute counts.**
