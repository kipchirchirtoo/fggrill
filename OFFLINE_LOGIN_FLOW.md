# Offline Login Flow - Visual Guide

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OFFLINE LOGIN FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

1. APP STARTUP
   ┌──────────────┐
   │ Electron App │
   │   Starts     │
   └──────┬───────┘
          │
          ├─→ Register pos:// protocol handler
          ├─→ Initialize PowerSync (local DB)
          ├─→ Setup IPC handlers
          ├─→ Create main window
          │
          ▼
   ┌──────────────┐
   │ Load Page    │
   │ pos://       │
   │ terminal.html│
   └──────┬───────┘
          │
          ▼

2. PAGE LOADING
   ┌──────────────────────────────────────────┐
   │ Protocol Handler Resolves Path           │
   ├──────────────────────────────────────────┤
   │ pos://terminal.html                      │
   │   ↓                                      │
   │ frontend/out/terminal.html               │
   │                                          │
   │ pos://terminal.html/_next/static/...    │
   │   ↓                                      │
   │ frontend/out/_next/static/...           │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ Preload.js Injects electronAPI           │
   ├──────────────────────────────────────────┤
   │ • DragEvent polyfill                     │
   │ • PointerEvent polyfill                  │
   │ • db, cache, sync, navigate functions    │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ React Hydration                          │
   ├──────────────────────────────────────────┤
   │ • Page becomes interactive               │
   │ • Event handlers attached                │
   │ • State initialized                      │
   └──────────────┬───────────────────────────┘
                  │
                  ▼

3. USER INTERACTION
   ┌──────────────┐
   │ User Enters  │
   │ PIN: R0123   │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────────────────────────┐
   │ handleLogin() Called                     │
   ├──────────────────────────────────────────┤
   │ console.log('[Terminal] handleLogin')    │
   │ console.log('isElectron:', true)         │
   │ console.log('isOnline:', false)          │
   └──────────────┬───────────────────────────┘
                  │
                  ▼

4. OFFLINE AUTHENTICATION
   ┌──────────────────────────────────────────┐
   │ verifyPinOffline(pin)                    │
   ├──────────────────────────────────────────┤
   │ IPC: cache:verifyPin                     │
   │   ↓                                      │
   │ Main Process                             │
   │   ↓                                      │
   │ PowerSync Query:                         │
   │ SELECT * FROM cached_pins WHERE id = ?   │
   │   ↓                                      │
   │ Return user data                         │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ User Found: {                            │
   │   id: "abc-123",                         │
   │   role: "cashier",                       │
   │   first_name: "John",                    │
   │   branch_id: 1                           │
   │ }                                        │
   └──────────────┬───────────────────────────┘
                  │
                  ▼

5. PREPARE REDIRECT
   ┌──────────────────────────────────────────┐
   │ Determine Target Path                    │
   ├──────────────────────────────────────────┤
   │ role === 'cashier'                       │
   │   ↓                                      │
   │ targetPath = '/dashboard/cashier'        │
   │   ↓                                      │
   │ redirectUrl = 'pos://terminal.html/      │
   │                dashboard/cashier'        │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ Store User Data                          │
   ├──────────────────────────────────────────┤
   │ localStorage.setItem('user', userData)   │
   │ localStorage.setItem('token', 'offline') │
   └──────────────┬───────────────────────────┘
                  │
                  ▼

6. NAVIGATION (Multi-Tier)
   ┌──────────────────────────────────────────┐
   │ Tier 1: IPC Navigation (Primary)         │
   ├──────────────────────────────────────────┤
   │ electronAPI.navigate(redirectUrl)        │
   │   ↓                                      │
   │ IPC: navigate                            │
   │   ↓                                      │
   │ Main Process:                            │
   │   mainWindow.loadURL(redirectUrl)        │
   │   ↓                                      │
   │ SUCCESS? → Dashboard loads ✓             │
   │   ↓                                      │
   │ FAIL? → Try Tier 2                       │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ Tier 2: window.location (Fallback)       │
   ├──────────────────────────────────────────┤
   │ window.location.href = redirectUrl       │
   │   ↓                                      │
   │ Browser navigates to pos:// URL          │
   │   ↓                                      │
   │ SUCCESS? → Dashboard loads ✓             │
   │   ↓                                      │
   │ FAIL? → Try Tier 3                       │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ Tier 3: Next.js Router (Last Resort)     │
   ├──────────────────────────────────────────┤
   │ router.push(targetPath)                  │
   │   ↓                                      │
   │ Client-side navigation                   │
   │   ↓                                      │
   │ Dashboard loads ✓                        │
   └──────────────┬───────────────────────────┘
                  │
                  ▼

7. DASHBOARD LOADS
   ┌──────────────────────────────────────────┐
   │ Protocol Handler Resolves                │
   ├──────────────────────────────────────────┤
   │ pos://terminal.html/dashboard/cashier    │
   │   ↓                                      │
   │ Check: dashboard/cashier (exact)         │
   │   ✗ Not found                            │
   │   ↓                                      │
   │ Check: dashboard/cashier.html            │
   │   ✓ Found!                               │
   │   ↓                                      │
   │ Load: frontend/out/dashboard/            │
   │       cashier.html                       │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │ Dashboard Page Loads                     │
   ├──────────────────────────────────────────┤
   │ • Read user from localStorage            │
   │ • Initialize dashboard state             │
   │ • Load cached data                       │
   │ • Show offline indicators                │
   │ • Enable offline operations              │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────┐
   │ ✅ SUCCESS!  │
   │ User logged  │
   │ in offline   │
   └──────────────┘
```

## 🔍 Key Components

### Protocol Handler
```javascript
pos://terminal.html/dashboard/cashier
         ↓
frontend/out/dashboard/cashier.html
```

**Resolution Chain:**
1. Exact match: `dashboard/cashier`
2. With .html: `dashboard/cashier.html` ✓
3. Index: `dashboard/cashier/index.html`
4. Fallback: `terminal.html`

### IPC Navigation
```javascript
Renderer                Main Process
   │                         │
   ├─ navigate(url) ────────→│
   │                         ├─ loadURL(url)
   │                         ├─ Protocol handler
   │                         ├─ Load HTML
   │←──── success ───────────┤
   │                         │
```

### Offline Auth
```javascript
Renderer                Main Process
   │                         │
   ├─ verifyPin(pin) ───────→│
   │                         ├─ PowerSync query
   │                         ├─ SELECT * FROM cached_pins
   │←──── user data ─────────┤
   │                         │
```

## 📊 Timing Diagram

```
Time    Event
────────────────────────────────────────────────────
0ms     User enters PIN
        │
10ms    handleLogin() called
        │
20ms    verifyPinOffline() IPC call
        │
50ms    PowerSync query executes
        │
60ms    User data returned
        │
70ms    localStorage.setItem()
        │
170ms   setTimeout delay (100ms)
        │
180ms   IPC navigate() called
        │
200ms   Protocol handler resolves path
        │
220ms   Dashboard HTML loads
        │
300ms   React hydration complete
        │
350ms   ✅ Dashboard fully interactive
```

## 🎯 Success Path

```
PIN Entry → Validation → Auth → Storage → Navigate → Load → Hydrate → Ready
   ✓           ✓         ✓        ✓         ✓        ✓       ✓       ✓
```

## ❌ Error Paths

### Invalid PIN
```
PIN Entry → Validation → Auth → ❌ Not Found
                                  │
                                  ▼
                            Toast Error
                                  │
                                  ▼
                            Clear PIN
                                  │
                                  ▼
                            Stay on Login
```

### Navigation Failure
```
PIN Entry → Validation → Auth → Storage → Navigate
                                            │
                                            ├─ IPC ❌
                                            │   ↓
                                            ├─ window.location ❌
                                            │   ↓
                                            └─ router.push ✓
```

### Asset Loading Failure
```
Dashboard Load → Protocol Handler → ❌ File Not Found
                                      │
                                      ▼
                                Fallback to terminal.html
                                      │
                                      ▼
                                Show Error Message
```

## 🔧 Debugging Points

### Check Point 1: Page Load
```
[Protocol] Request: pos://terminal.html
[Protocol] ✓ Found: terminal.html
```

### Check Point 2: Hydration
```
[Renderer INFO] [Terminal] Page mounted successfully
[Renderer INFO] [Terminal] electronAPI available: true
```

### Check Point 3: Login
```
[Terminal] handleLogin called
[Terminal] isElectron: true
[Terminal] isOnline: false
```

### Check Point 4: Auth
```
[Cache] Verifying PIN offline...
[Cache] PIN verified successfully
```

### Check Point 5: Navigation
```
[Terminal] Executing redirect...
[IPC] Navigation requested
[IPC] Navigation successful
```

### Check Point 6: Dashboard Load
```
[Protocol] Request: pos://terminal.html/dashboard/cashier
[Protocol] ✓ Found route HTML
```

---

**Use this diagram to:**
- Understand the complete flow
- Debug issues at each step
- Verify timing expectations
- Identify failure points
