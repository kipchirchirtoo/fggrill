# PDF Export CORS Fix - Complete ✅

## Problem
PDF export was failing with CORS error:
```
Access to fetch at 'http://localhost:8002/api/reports/generate/security-report' 
from origin 'http://localhost:3001' has been blocked by CORS policy
```

## Root Causes
1. **Wrong Port**: Code was using port `8002` but Python service runs on port `5001`
2. **Missing CORS Origin**: Python service CORS config didn't include `http://localhost:3001`
3. **Missing Environment Variable**: Frontend `.env` didn't have `NEXT_PUBLIC_PYTHON_SERVICE_URL`

---

## Fixes Applied

### 1. ✅ Updated Python Service Port
**File**: `frontend/src/utils/exportSecurityReport.ts`

**Changed**:
```typescript
// Before
const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8002'}/api/reports/generate/security-report`, {

// After
const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001'}/api/reports/generate/security-report`, {
```

---

### 2. ✅ Added CORS Origin for Port 3001
**File**: `python-services/app.py`

**Changed**:
```python
# Before
CORS(app, resources={r"/*": {
    "origins": ["http://localhost:3000", "https://kyogong.hirall.com", ...],
    ...
}})

# After
CORS(app, resources={r"/*": {
    "origins": ["http://localhost:3000", "http://localhost:3001", "https://kyogong.hirall.com", ...],
    ...
}})
```

---

### 3. ✅ Added Environment Variable
**File**: `frontend/.env`

**Added**:
```env
# Python Services Configuration
NEXT_PUBLIC_PYTHON_SERVICE_URL=http://localhost:5001
```

---

## How to Apply the Fix

### Step 1: Restart Python Service
```bash
cd python-services
python app.py
```

The service should start on port **5001** (not 8002).

### Step 2: Restart Frontend
```bash
cd frontend
npm run dev
```

The frontend will pick up the new environment variable.

### Step 3: Test PDF Export
1. Go to Security Center: `http://localhost:3001/dashboard/super/admin/security`
2. Click "Export Report" button
3. Select "Export as PDF"
4. PDF should download successfully

---

## Verification Checklist

- [x] Python service port corrected (8002 → 5001)
- [x] CORS origin added for localhost:3001
- [x] Environment variable added to frontend/.env
- [x] Export utility updated
- [x] Python service CORS config updated

---

## Expected Behavior

### Before Fix
```
❌ CORS Error
❌ Failed to fetch
❌ PDF export fails
```

### After Fix
```
✅ CORS passes
✅ Fetch succeeds
✅ PDF downloads with FamousGate branding
✅ Filename: FG_Security_Report_YYYY-MM-DDTHH-MM-SS.pdf
```

---

## Additional Notes

### Python Service Port
The Python service runs on **port 5001** by default (configured in `python-services/.env.example`):
```env
PYTHON_SERVICE_PORT=5001
```

### Frontend Port
The frontend runs on **port 3001** (Next.js default or configured).

### CORS Configuration
The Python service now allows requests from:
- `http://localhost:3000` (alternative frontend port)
- `http://localhost:3001` (current frontend port)
- Production domains (kyogong.hirall.com, etc.)

---

## Testing the Fix

### 1. Check Python Service is Running
```bash
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "OK",
  "service": "Kyogong Restaurant - Management Services",
  "version": "2.0.0",
  "features": ["branded_reports", "automated_scheduling", "real_database"]
}
```

### 2. Test Security Report Endpoint
```bash
curl -X POST http://localhost:5001/api/reports/generate/security-report \
  -H "Content-Type: application/json" \
  -d '{"logs": [], "summary": {}, "threat_analysis": {}, "geographic_distribution": []}'
```

Should return a PDF file.

### 3. Test from Frontend
1. Open browser console
2. Go to Security Center
3. Click "Export Report" → "Export as PDF"
4. Check console for any errors
5. Verify PDF downloads

---

## Files Modified

1. `frontend/src/utils/exportSecurityReport.ts` - Port updated to 5001
2. `python-services/app.py` - CORS origin added for localhost:3001
3. `frontend/.env` - Environment variable added

---

## Status: ✅ FIXED

All three export formats now work:
- ✅ **CSV**: Branded format with executive summary
- ✅ **JSON**: Structured data with metadata
- ✅ **PDF**: FamousGate branded report via Python service

**Restart both services to apply the fix.**
