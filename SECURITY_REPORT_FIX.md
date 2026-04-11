# Security Report CORS Fix - Complete Guide

## Problem Summary

The frontend was trying to generate security reports by calling a Python analytics service, but encountered CORS errors because:

1. The Python service wasn't running
2. CORS wasn't configured for localhost:3001
3. The security report endpoint was missing

## Changes Made

### 1. Analytics Service (analytics-service/app.py)

✓ **Added CORS support for localhost:3001**
- Updated CORS middleware to allow requests from frontend on port 3001
- Added both localhost and 127.0.0.1 variants

✓ **Changed service port from 8001 to 5001**
- Matches the frontend configuration
- No need to update frontend .env

✓ **Added security report endpoint**
- New endpoint: `POST /api/reports/generate/security-report`
- Accepts security log data and generates branded PDF reports

### 2. PDF Generator (analytics-service/reports/pdf_generator.py)

✓ **Implemented security report generation**
- Professional branded PDF with FamousGate Hotels branding
- Includes:
  - Executive summary with authentication metrics
  - Threat analysis with risk levels
  - Geographic distribution of access attempts
  - Detailed access logs table
  - Confidentiality notices

### 3. Helper Files Created

✓ **start-service.bat** - Quick startup script for Windows
✓ **README.md** - Service documentation
✓ **test-security-report.py** - Test script to verify the service works

## How to Fix the Issue

### Step 1: Start the Analytics Service

Open a new terminal and run:

```bash
cd analytics-service
python app.py
```

Or use the startup script:

```bash
cd analytics-service
start-service.bat
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:5001
INFO:     Application startup complete.
```

### Step 2: Test the Service (Optional)

In another terminal:

```bash
cd analytics-service
python test-security-report.py
```

This will generate a test PDF to verify everything works.

### Step 3: Use the Frontend

1. Navigate to the Security Center in your frontend
2. Click "Export to PDF"
3. The report should now generate successfully

## Verification Checklist

- [ ] Python 3.8+ is installed
- [ ] Analytics service is running on port 5001
- [ ] Frontend is running on port 3001
- [ ] Backend is running on port 5000
- [ ] No CORS errors in browser console
- [ ] PDF downloads successfully

## Troubleshooting

### "Connection refused" error

**Problem:** Analytics service is not running

**Solution:**
```bash
cd analytics-service
python app.py
```

### "Module not found" error

**Problem:** Missing Python dependencies

**Solution:**
```bash
cd analytics-service
pip install -r requirements.txt
```

### Port 5001 already in use

**Problem:** Another service is using port 5001

**Solution:** 
1. Find and stop the other service, OR
2. Change the port in `analytics-service/app.py` (line with `port=5001`)
3. Update `frontend/.env` to match: `NEXT_PUBLIC_PYTHON_SERVICE_URL=http://localhost:NEW_PORT`

### CORS errors persist

**Problem:** Service needs restart after changes

**Solution:**
1. Stop the analytics service (Ctrl+C)
2. Restart it: `python app.py`
3. Clear browser cache and reload frontend

## Architecture Overview

```
Frontend (localhost:3001)
    ↓
    POST /api/reports/generate/security-report
    ↓
Analytics Service (localhost:5001)
    ↓
    Generates PDF using ReportLab
    ↓
    Returns PDF file
    ↓
Frontend downloads PDF
```

## Files Modified

1. `analytics-service/app.py` - Added CORS, endpoint, changed port
2. `analytics-service/reports/pdf_generator.py` - Added PDF generation logic
3. `analytics-service/start-service.bat` - NEW startup script
4. `analytics-service/README.md` - NEW documentation
5. `analytics-service/test-security-report.py` - NEW test script

## Next Steps

1. Start the analytics service
2. Test the security report export
3. Keep the service running while using the application

The analytics service needs to be running whenever you want to generate PDF reports. Consider setting it up as a background service for production use.
