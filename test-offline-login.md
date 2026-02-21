# Offline Login Test Script

## Prerequisites
1. Frontend must be built: `cd frontend && npm run build`
2. Electron app must be running: `npm run electron:dev`

## Test Steps

### Step 1: Verify App Startup
- [ ] App window opens
- [ ] Terminal login page displays
- [ ] Background image loads
- [ ] PIN pad is visible and styled correctly
- [ ] Status indicator shows "Offline Mode" (amber badge)

**Expected Console Output:**
```
[Main] Script loaded, checking lock...
[Main] Lock acquired.
--- App Startup ---
isDev: true
app.isPackaged: false
DOMAIN_URL: http://127.0.0.1:3001
API_BASE_URL: http://127.0.0.1:5000
-------------------
[Main] FRONTEND_OUT_PATH: C:\path\to\frontend\out
[PowerSync] Initialized at: C:\Users\...\AppData\Roaming\fggrill-central\powersync.db
[App] Loading local offline UI...
[App] Switching to local offline UI: pos://terminal.html
[Protocol] Request: pos://terminal.html
[Protocol] Resolving: terminal.html -> C:\path\to\frontend\out\terminal.html
[Protocol] ✓ Exact match: C:\path\to\frontend\out\terminal.html
[Protocol] Final: pos://terminal.html -> C:\path\to\frontend\out\terminal.html
```

### Step 2: Verify Page Hydration
- [ ] Open DevTools (Ctrl+Shift+I)
- [ ] Go to Console tab
- [ ] Check for hydration success

**Expected Console Output:**
```
[Renderer INFO] [Terminal] Page mounted successfully
[Renderer INFO] [Terminal] Environment check:
[Renderer INFO]   - DragEvent available: true
[Renderer INFO]   - PointerEvent available: true
[Renderer INFO]   - electronAPI available: true
[Renderer INFO] [Terminal] Window.terminalMounted flag set
```

**Check for Errors:**
- [ ] No "Hydration failed" errors
- [ ] No "DragEvent is not defined" errors
- [ ] No 404 errors for assets

### Step 3: Verify Asset Loading
- [ ] Go to Network tab in DevTools
- [ ] Refresh page (Ctrl+R)
- [ ] Check that all assets load:
  - [ ] `terminal.html` - 200
  - [ ] `_next/static/chunks/*.js` - 200
  - [ ] `_next/static/css/*.css` - 200
  - [ ] Images (if any) - 200

**Expected Protocol Logs:**
```
[Protocol] Request: pos://terminal.html/_next/static/chunks/main-abc123.js
[Protocol] Resolving: _next/static/chunks/main-abc123.js -> C:\path\to\frontend\out\_next\static\chunks\main-abc123.js
[Protocol] ✓ Exact match: C:\path\to\frontend\out\_next\static\chunks\main-abc123.js
```

### Step 4: Test PIN Input
- [ ] Click number buttons (1-9, 0)
- [ ] Click letter buttons (R, B, C)
- [ ] Verify PIN dots fill up
- [ ] Test keyboard input (type numbers and letters)
- [ ] Test backspace/delete

**Expected Behavior:**
- PIN dots animate when filled
- Maximum 5 characters
- Keyboard input works
- Delete button removes last character

### Step 5: Test Offline Login
- [ ] Enter a valid PIN (e.g., R0123)
- [ ] Watch Console for login flow

**Expected Console Output:**
```
[Renderer INFO] [Terminal] handleLogin called
[Renderer INFO] [Terminal] isElectron: true
[Renderer INFO] [Terminal] isOnline: false
[Renderer INFO] [Terminal] PIN length: 5
[Renderer INFO] [Terminal] Offline login attempt...
[Cache] Verifying PIN offline...
[Cache] PIN verified successfully for user_id: abc-123-def-456
[Renderer INFO] [Terminal] Cached user result: {id: "abc-123", role: "cashier", first_name: "John", ...}
[Renderer INFO] [Terminal] Target path: /dashboard/cashier
[Renderer INFO] [Terminal] Redirect URL: pos://terminal.html/dashboard/cashier
[Renderer INFO] [Terminal] Executing redirect...
[IPC] Navigation requested: pos://terminal.html/dashboard/cashier
[Protocol] Request: pos://terminal.html/dashboard/cashier
[Protocol] Resolving: dashboard/cashier -> C:\path\to\frontend\out\dashboard\cashier
[Protocol] ✓ Found route HTML: C:\path\to\frontend\out\dashboard\cashier.html
[Protocol] Final: pos://terminal.html/dashboard/cashier -> C:\path\to\frontend\out\dashboard\cashier.html
[IPC] Navigation successful: pos://terminal.html/dashboard/cashier
[Renderer INFO] [Terminal] IPC navigation successful
```

**Expected Behavior:**
- [ ] Toast notification: "Offline login: [Name]"
- [ ] Redirect happens within 200ms
- [ ] Dashboard page loads
- [ ] User is logged in (check localStorage)

### Step 6: Verify Dashboard Load
- [ ] Dashboard page displays correctly
- [ ] User name/role shows in header
- [ ] Navigation menu works
- [ ] Data loads (or shows offline indicators)

**Check localStorage:**
```javascript
// In DevTools Console:
JSON.parse(localStorage.getItem('user'))
// Should show: {id: "...", role: "cashier", first_name: "...", ...}

localStorage.getItem('token')
// Should show: "offline-bridge-token"
```

### Step 7: Test Invalid PIN
- [ ] Go back to terminal page
- [ ] Enter invalid PIN (e.g., X9999)
- [ ] Verify error handling

**Expected Behavior:**
- [ ] Toast error: "PIN not recognized offline"
- [ ] PIN field clears
- [ ] No redirect occurs
- [ ] User stays on login page

## Troubleshooting

### Issue: Page Not Loading
**Check:**
1. Is `frontend/out` directory present?
   ```bash
   ls frontend/out
   # Should show: terminal.html, dashboard/, _next/, etc.
   ```
2. Run build again:
   ```bash
   cd frontend && npm run build
   ```

### Issue: Assets 404
**Check Protocol Logs:**
```
[Protocol] Request: pos://terminal.html/_next/static/...
[Protocol] ✗ Could not resolve: ...
```

**Solution:**
- Verify file exists in `frontend/out/_next/static/`
- Check path resolution in protocol handler

### Issue: Page Not Interactive
**Check Console for:**
- Hydration errors
- JavaScript errors
- Missing polyfills

**Solution:**
- Verify preload.js is loaded
- Check for "DragEvent is not defined" errors
- Restart Electron app

### Issue: Redirect Not Working
**Check Console for:**
```
[Terminal] Executing redirect...
[IPC] Navigation requested: ...
```

**If IPC navigation fails:**
- Check that IPC handler is registered in main.js
- Verify preload.js exposes navigate function
- Try window.location fallback

**If window.location fails:**
- Check that target path exists in frontend/out
- Verify protocol handler resolves the path correctly

### Issue: "PIN not recognized offline"
**Check:**
1. Are users cached?
   ```
   [Auto-Import] Found X cached PINs, skipping import
   ```
2. If 0 cached PINs, check Supabase connection
3. Manually trigger import:
   ```javascript
   // In DevTools Console:
   window.electronAPI.cache.importUsers()
   ```

## Success Criteria

✅ All assets load without 404 errors
✅ Page is fully interactive
✅ PIN input works (mouse and keyboard)
✅ Offline login succeeds with valid PIN
✅ Redirect completes within 200ms
✅ Dashboard loads correctly
✅ User data persists in localStorage
✅ Invalid PIN shows error (no crash)

## Test Results

Date: _______________
Tester: _______________

| Test Step | Pass | Fail | Notes |
|-----------|------|------|-------|
| App Startup | ☐ | ☐ | |
| Page Hydration | ☐ | ☐ | |
| Asset Loading | ☐ | ☐ | |
| PIN Input | ☐ | ☐ | |
| Offline Login | ☐ | ☐ | |
| Dashboard Load | ☐ | ☐ | |
| Invalid PIN | ☐ | ☐ | |

**Overall Result:** ☐ PASS ☐ FAIL

**Additional Notes:**
_____________________________________________
_____________________________________________
_____________________________________________
