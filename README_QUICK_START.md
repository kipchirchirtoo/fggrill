# 🚀 Famous Gate Hotel - Quick Start Guide

## ✅ Current Status: ALL SYSTEMS OPERATIONAL

- ✅ **Backend**: RUNNING (Port 5000)
- ✅ **Frontend**: RUNNING (Port 3001)
- ✅ **Database**: CONNECTED (Supabase)

---

## 🎯 Quick Commands

### Check System Status
```bash
./CHECK_STATUS.sh
```

### Start All Services
```bash
./START_ALL.sh
```

### Stop All Services
```bash
./STOP_ALL.sh
```

---

## 🌐 Access Points

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health

---

## 🔧 Individual Service Commands

### Backend Only
```bash
# Start
cd backend && npm start

# Start in background
cd backend && nohup npm start > ../backend.log 2>&1 &

# Stop
lsof -ti:5000 | xargs kill
```

### Frontend Only
```bash
# Start
cd frontend && npm run dev

# Start in background
cd frontend && nohup npm run dev > ../frontend.log 2>&1 &

# Stop
lsof -ti:3001 | xargs kill
```

---

## 📋 Common Issues & Fixes

### 1. "TypeError: Failed to fetch" Errors

**Problem**: Backend not running

**Fix**:
```bash
cd backend && npm start
```

### 2. Hydration Errors

**Problem**: Browser cache

**Fix**:
1. Open DevTools (F12)
2. Application tab → Clear storage
3. Hard refresh (Ctrl+Shift+R)

Or use incognito mode:
```bash
# Chrome/Edge
Ctrl+Shift+N

# Firefox
Ctrl+Shift+P
```

### 3. Port Already in Use

**Problem**: Old process still running

**Fix**:
```bash
# Kill backend
lsof -ti:5000 | xargs kill -9

# Kill frontend
lsof -ti:3001 | xargs kill -9
```

### 4. Database Connection Errors

**Problem**: Wrong credentials or network issue

**Check**: `backend/.env` file has correct Supabase credentials

---

## 📊 Database Migrations

### Run New Migration
```bash
cd backend
npm run migrate
```

### Check Migration Status
```bash
cd backend
npm run migrate:status
```

---

## 🎨 Frontend Development

### Clear All Caches
```bash
cd frontend
rm -rf .next node_modules/.cache
npm run dev
```

### Build for Production
```bash
cd frontend
npm run build
npm start
```

---

## 🐛 Debugging

### View Backend Logs
```bash
# If running in foreground
# Logs appear in terminal

# If running in background
tail -f backend.log
```

### View Frontend Logs
```bash
# If running in foreground
# Logs appear in terminal

# If running in background
tail -f frontend.log
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Test auth (will fail without token, that's OK)
curl http://localhost:5000/api/auth/me

# Test rooms endpoint
curl http://localhost:5000/api/rooms
```

---

## 📁 Project Structure

```
fggrill/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── controllers/  # Business logic
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, logging, etc.
│   │   └── config/       # Configuration
│   └── dist/             # Compiled JavaScript
│
├── frontend/             # Next.js application
│   ├── src/
│   │   ├── app/          # Pages (App Router)
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities, API client
│   └── .next/            # Build output
│
├── analytics-service/    # Python analytics
│   ├── app.py            # Main FastAPI app
│   └── maa_analytics.py  # MAA module analytics
│
└── Scripts/              # Utility scripts
    ├── START_ALL.sh
    ├── STOP_ALL.sh
    └── CHECK_STATUS.sh
```

---

## 🔑 Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_KEY=...
JWT_SECRET=...
PORT=5000
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 🚀 Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

### Analytics Service
```bash
cd analytics-service
pip install -r requirements.txt
python app.py
```

---

## 📚 Documentation

- `API_ERRORS_FIXED.md` - API troubleshooting
- `HYDRATION_NUCLEAR_FIX_COMPLETE.md` - Hydration errors
- `MAA_IMPLEMENTATION_COMPLETE.md` - Maintenance/Audit/Accounting
- `RESTAURANT_ENHANCEMENT_SUMMARY.md` - Restaurant module

---

## 🆘 Getting Help

### Check System Status
```bash
./CHECK_STATUS.sh
```

### Restart Everything
```bash
./STOP_ALL.sh
./START_ALL.sh
```

### Complete Reset
```bash
# Stop all
./STOP_ALL.sh

# Clear caches
cd frontend && rm -rf .next node_modules/.cache
cd ../backend && rm -rf dist

# Rebuild
cd backend && npm run build
cd ../frontend && npm run build

# Start all
cd .. && ./START_ALL.sh
```

---

## ✅ Daily Workflow

### Morning Startup
```bash
cd /home/john/fggrill
./START_ALL.sh
```

### Evening Shutdown
```bash
cd /home/john/fggrill
./STOP_ALL.sh
```

### Quick Status Check
```bash
./CHECK_STATUS.sh
```

---

## 🎉 Everything is Working!

Your system is fully operational:
- ✅ Backend serving API requests
- ✅ Frontend running smoothly
- ✅ Database connected
- ✅ All errors fixed

**Just refresh your browser and start using the system!** 🚀
