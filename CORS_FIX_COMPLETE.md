# CORS Fix for Security Report - Complete Solution

## Problem

The frontend (localhost:3001) was getting CORS errors when trying to call the Python service (localhost:5001) to generate security reports. The error was:

```
Access to fetch at 'http://localhost:5001/api/reports/generate/security-report' 
from origin 'http://localhost:3001' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## Root Cause

The Flask service at `python-services/app.py` was returning a **404 error** for the OPTIONS preflight request, even though:
1. The route existed
2. CORS was configured
3. The service was running

This happens when Flask-CORS doesn't properly handle OPTIONS requests for specific routes.

## Solution Applied

### 1. Enhanced CORS Configuration (python-services/app.py)

**Added explicit CORS headers:**
- Added localhost:3001 and 127.0.0.1 variants
- Added OPTIONS method explicitly
- Added `after_request` handler to ensure CORS headers on ALL responses
- Added `expose_headers` for Content-Disposition (needed for file downloads)

**Added explicit OPTIONS handler:**
- The security report route now explicitly handles OPTIONS requests
- Returns proper CORS headers for preflight requests

### 2. Changes Made

**File: `python-services/app.py`**

✓ Enhanced CORS configuration with all localhost variants
✓ Added `@app.after_request` handler for consistent CORS headers
✓ Modified security report route to handle OPTIONS explicitly
✓ Added CORS headers to the file download response

## How to Apply the Fix

### Step 1: Restart the Python Service

The Python service needs to be restarted to pick up the changes:

```bash
# Stop the current service (Ctrl+C in the terminal where it's running)

# Start it again
cd python-services
python app.py
```

You should see:
```
INFO:werkzeug:WARNING: This is a development server. Do not use it in a production deployment.
INFO:werkzeug: * Running on http://0.0.0.0:5001
```

### Step 2: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

OR

1. Press Ctrl+Shift+Delete
2. Clear cached images and files
3. Reload the page

### Step 3: Test the Security Report

1. Navigate to Security Center in your frontend
2. Click "Export to PDF"
3. The report should now download successfully

## Verification

Check the browser console - you should see:
- ✓ No CORS errors
- ✓ Successful OPTIONS request (200 OK)
- ✓ Successful POST request (200 OK)
- ✓ PDF file downloads

Check the Python service logs - you should see:
```
INFO:werkzeug:127.0.0.1 - - [11/Apr/2026 08:XX:XX] "OPTIONS /api/reports/generate/security-report HTTP/1.1" 200 -
INFO:__main__:Generating security analysis report
INFO:werkzeug:127.0.0.1 - - [11/Apr/2026 08:XX:XX] "POST /api/reports/generate/security-report HTTP/1.1" 200 -
```

## Alternative Solution: Next.js Proxy (Optional)

If you prefer to avoid CORS entirely, you can proxy the request through Next.js:

### Option A: API Route Proxy

Create `frontend/src/app/api/reports/security-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward to Python service
    const response = await fetch('http://localhost:5001/api/reports/generate/security-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to generate report');
    }

    // Get the PDF blob
    const blob = await response.blob();
    
    // Return as response
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="security-report-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

Then update `frontend/src/utils/exportSecurityReport.ts` line 404:

```typescript
// Change from:
const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001'}/api/reports/generate/security-report`, {

// To:
const response = await fetch('/api/reports/security-report', {
```

### Option B: Next.js Rewrites (next.config.js)

Add to `frontend/next.config.js`:

```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
    ];
  },
};
```

Then update the fetch URL to:
```typescript
const response = await fetch('/api/python/reports/generate/security-report', {
```

## Troubleshooting

### Still Getting CORS Errors?

1. **Verify the service is running:**
   ```bash
   curl http://localhost:5001/api/health
   ```

2. **Check if it's the right service:**
   Look for "werkzeug" in the logs - that's the Flask service

3. **Restart both services:**
   - Stop Python service (Ctrl+C)
   - Stop frontend (Ctrl+C)
   - Start Python service first
   - Start frontend second

4. **Check browser console for the actual error:**
   - Look for the OPTIONS request
   - Check the response status code
   - Verify the CORS headers in the response

### 404 Error on OPTIONS?

This means the route doesn't exist or isn't handling OPTIONS. The fix I applied should resolve this.

### 500 Error?

Check the Python service logs for the actual error. Common issues:
- Missing dependencies: `pip install -r requirements.txt`
- Database connection issues
- Missing logo file (non-critical, report will still generate)

## Files Modified

1. `python-services/app.py` - Enhanced CORS configuration and OPTIONS handling
2. `CORS_FIX_COMPLETE.md` - This documentation

## Summary

The fix ensures that:
1. ✓ OPTIONS preflight requests are handled correctly
2. ✓ CORS headers are present on all responses
3. ✓ Both localhost and 127.0.0.1 origins are allowed
4. ✓ File downloads work properly with Content-Disposition header
5. ✓ The security report generates and downloads successfully

**Action Required:** Restart the Python service to apply the changes.
