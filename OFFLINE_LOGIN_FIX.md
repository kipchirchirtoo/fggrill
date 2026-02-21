# Offline Login & Redirection Fix - Complete Solution

## Problem Summary
The Electron app was getting stuck on the login page after successful offline PIN verification. The dashboard redirection was not working.

## Root Causes Identified

### 1. **Protocol Handler Issues**
- The `pos://` protocol handler was not correctly resolving Next.js routes
- Asset paths like `/_next/static/...` were not being served properly
- Route paths like `/dashboard/cashier` were not resolving to the correct HTML files

### 2. **Hydration Failures**
- React/Next.js JavaScript bundles were not loading
- Missing polyfills for `DragEvent` and `PointerEvent` caused renderer crashes
- The page appeared but was non-interactive (no event handlers working)

### 3. **Redirection Logic Problems**
- Using `window.location.replace()` with `pos://` URLs was unreliable
- The URL format `pos://terminal.html/dashboard/cashier` was confusing
- No proper error handling or fallback mechanisms

## Fixes Implemented

### 1. Enhanced Protocol Handler (`electron/main.js`)

**Changes:**
- Improved path resolution logic with detailed logging
- Better handling of `pos://terminal.html/path` format
- Proper fallback chain: exact match → .html extension → index.html → terminal.html
- Added comprehensive console logging for debugging

**Key improvements:**
```javascript
// Now correctly handles:
// pos://terminal.html/dashboard/cashier -> frontend/out/dashboard/cashier.html
// pos://terminal.html/_next/static/... -> frontend/out/_next/static/...
// pos://terminal.html/ -> frontend/out/terminal.html
```

### 2. Renderer Console Logging (`electron/main.js`)

**Added:**
```javascript
mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'LOG';
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
});
```

This streams all renderer console logs to the main process terminal for debugging.

### 3. Polyfills Already in Place (`electron/preload.js`)

The polyfills for `DragEvent` and `PointerEvent` were already implemented:
```javascript
if (typeof window.DragEvent === 'undefined') {
    window.DragEvent = class DragEvent extends UIEvent { };
}
if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = class PointerEvent extends UIEvent { };
}
```

### 4. Improved Login Handler (`frontend/src/app/terminal/page.tsx`)

**Changes:**
- Removed debug alerts that were blocking execution
- Added comprehensive console logging
- Improved error handling
- Changed from `window.location.replace()` to `window.location.href` for better reliability
- Added 100ms delay to ensure localStorage persists before redirect

**Key improvements:**
```typescript
// Better logging
console.log('[Terminal] handleLogin called');
console.log('[Terminal] isElectron:', isElectron);
console.log('[Terminal] isOnline:', isOnline);

// Reliable redirection
const redirectUrl = `pos://terminal.html/${cleanPath}`;
setTimeout(() => {
    console.log('[Terminal] Executing redirect...');
    window.location.href = redirectUrl;
}, 100);
```

## Testing Checklist

### 1. Verify Asset Loading
- [ ] Open DevTools in Electron (Ctrl+Shift+I)
- [ ] Check Network tab for `_next/static/` files
- [ ] Verify all assets return 200 status
- [ ] Check Console for any 404 errors

### 2. Verify Hydration
- [ ] Check Console for React hydration errors
- [ ] Verify page is interactive (buttons clickable)
- [ ] Test keyboard input on PIN pad
- [ ] Verify animations work (Framer Motion)

### 3. Verify Offline Login
- [ ] Force offline mode (already set in main.js)
- [ ] Enter a valid PIN (e.g., R0123)
- [ ] Check Console logs for:
   ```
   [Terminal] handleLogin called
   [Terminal] Offline login attempt...
   [Terminal] Cached user result: {...}
   [Terminal] Target path: /dashboard/cashier
   [Terminal] Redirect URL: pos://terminal.html/dashboard/cashier
   [Terminal] Executing redirect...
   ```
- [ ] Verify redirection occurs within 200ms
- [ ] Verify dashboard page loads correctly

### 4. Verify Online Login
- [ ] Remove offline force in main.js:
   ```javascript
   // Comment out these lines:
   // ipcMain.removeHandler('net:isOnline');
   // ipcMain.handle('net:isOnline', () => false);
   ```
- [ ] Test online login with API
- [ ] Verify PIN is cached for offline use
- [ ] Verify normal routing works

## Debugging Commands

### View Main Process Logs
```bash
# Run Electron in dev mode
npm run electron:dev
```

### View Renderer Logs
1. Open DevTools: `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
2. Go to Console tab
3. All logs prefixed with `[Terminal]` are from the login page

### Check Protocol Handler
Look for logs like:
```
[Protocol] Request: pos://terminal.html/dashboard/cashier
[Protocol] Resolving: dashboard/cashier -> C:\path\to\frontend\out\dashboard\cashier
[Protocol] ✓ Found route HTML: C:\path\to\frontend\out\dashboard\cashier.html
[Protocol] Final: pos://terminal.html/dashboard/cashier -> C:\path\to\frontend\out\dashboard\cashier.html
```

### Check Offline Login Flow
Look for logs like:
```
[Terminal] handleLogin called
[Terminal] isElectron: true
[Terminal] isOnline: false
[Terminal] PIN length: 5
[Terminal] Offline login attempt...
[Cache] Verifying PIN offline...
[Cache] PIN verified successfully for user_id: abc-123
[Terminal] Cached user result: {id: "abc-123", role: "cashier", ...}
[Terminal] Target path: /dashboard/cashier
[Terminal] Redirect URL: pos://terminal.html/dashboard/cashier
[Terminal] Executing redirect...
```

## Common Issues & Solutions

### Issue: Assets Not Loading (404 errors)
**Solution:** Check that `frontend/out` directory exists and contains all built files
```bash
cd frontend
npm run build
```

### Issue: Page Loads But Not Interactive
**Solution:** Check for hydration errors in Console
- Look for "Hydration failed" messages
- Verify all polyfills are loaded (check preload.js)

### Issue: Redirect Not Working
**Solution:** Check Console for redirect logs
- Verify `window.location.href` is being called
- Check that target path exists in `frontend/out`
- Try using `window.location.replace()` as alternative

### Issue: "DragEvent is not defined" Error
**Solution:** Verify preload.js is loaded before renderer
- Check `webPreferences.preload` path in main.js
- Ensure polyfills are at top of preload.js

## Next Steps

1. **Test the fixes:**
   ```bash
   # Build frontend
   cd frontend
   npm run build
   
   # Run Electron
   cd ..
   npm run electron:dev
   ```

2. **Monitor logs** for any errors or warnings

3. **Test offline login** with a valid PIN

4. **Verify dashboard loads** after successful login

5. **Test online login** (remove offline force)

## Additional Improvements (Optional)

### 1. Add IPC-Based Navigation
For even more reliable navigation, add an IPC handler:

**In `electron/main.js`:**
```javascript
ipcMain.handle('navigate', async (_, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url);
        return true;
    }
    return false;
});
```

**In `electron/preload.js`:**
```javascript
navigate: (url) => ipcRenderer.invoke('navigate', url),
```

**In `frontend/src/app/terminal/page.tsx`:**
```typescript
if ((window as any).electronAPI?.navigate) {
    await (window as any).electronAPI.navigate(redirectUrl);
} else {
    window.location.href = redirectUrl;
}
```

### 2. Add Loading State During Redirect
Show a loading indicator while redirecting:
```typescript
setIsAuthenticating(true); // Keep this true during redirect
// Don't set to false - let the new page load
```

### 3. Add Retry Logic
If redirect fails, retry after a delay:
```typescript
let retries = 0;
const maxRetries = 3;

const attemptRedirect = () => {
    try {
        window.location.href = redirectUrl;
    } catch (error) {
        retries++;
        if (retries < maxRetries) {
            setTimeout(attemptRedirect, 500);
        } else {
            toast.error('Navigation failed. Please restart the app.');
        }
    }
};

attemptRedirect();
```

## Success Criteria

✅ Login page loads with all assets (no 404s)
✅ Page is interactive (buttons work, keyboard input works)
✅ Offline PIN verification succeeds
✅ Redirection occurs within 200ms
✅ Dashboard page loads correctly
✅ User data persists in localStorage
✅ No console errors or warnings

## Files Modified

1. `electron/main.js` - Enhanced protocol handler and logging
2. `frontend/src/app/terminal/page.tsx` - Improved login handler
3. `OFFLINE_LOGIN_FIX.md` - This documentation

## Rollback Instructions

If issues persist, revert changes:
```bash
git checkout electron/main.js
git checkout frontend/src/app/terminal/page.tsx
```

Then investigate further using the debugging commands above.
