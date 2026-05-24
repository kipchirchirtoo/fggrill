🎯 MISSION
Build the **Terminal Login Page** for Famous Gates Flutter app — this is the POS entry point where staff log in with their PIN codes.

This page must match the web app's `/terminal` page exactly in UI and functionality. It's the first screen users see on POS terminals.

**⚠️ CRITICAL: DO NOT COMMIT AND PUSH CODE FIRST!! Build locally, test thoroughly, then commit when ready.**

---

## 📱 SCREEN: TERMINAL LOGIN

### Route
- Path: `/terminal`
- This is the entry point for all POS logins

### UI Layout (Match Web App Exactly)

**Background:**
- Full-screen background image: `assets/IMG_8704.JPG` (copy from frontend/public/IMG_8704.JPG)
- Dark gradient overlay: `from-black/80 via-black/60 to-black/80` with `backdrop-blur-[3px]`

**Top Right - Backoffice Button:**
- Position: Absolute, top-right corner
- Hidden on small screens (< 640px), visible on desktop/tablet
- Style: 
  - Background: `bg-white/5 backdrop-blur-md`
  - Border: `border border-white/10`
  - Text: `text-[10px] font-bold text-white/50 hover:text-white`
  - Padding: `px-5 py-2.5`
  - Rounded: `rounded-full`
  - Uppercase with tracking: `uppercase tracking-[0.15em]`
- Icon: ArrowRight icon (right arrow)
- Action: Navigate to `/login` (backoffice login)
- Hover effect: `hover:bg-white/10`, icon translates right on hover

**Header - Time & Date:**
- Centered at top
- Time: Large text `text-5xl sm:text-6xl font-bold tracking-tight text-white/90`
- Format: HH:MM AM/PM (12-hour format)
- Date: Smaller text `text-xs sm:text-sm text-white/50 uppercase tracking-wide font-medium`
- Format: "Weekday, Mon Day" (e.g., "Fri, May 24")
- Vertical divider between time and date: `h-10 w-[1px] bg-white/20`

**Online/Offline Status (Electron/Desktop only):**
- Shows on desktop/tablet only
- Connected state: Green badge with Wifi icon, text "Connected"
- Offline state: Amber badge with WifiOff icon, text "Offline Mode"
- Pending sync badge: Indigo badge with RefreshCw icon (spinning), shows count

**PIN Entry Area:**
- Center of screen
- Label: "Enter PIN" with ShieldCheck icon, `text-[11px] text-white/40 font-medium uppercase tracking-[0.2em]`
- 5 PIN dots: 
  - Each dot: `w-3.5 h-3.5 rounded-full border border-white/20`
  - Empty: `bg-white/15`
  - Filled: `bg-white/95` with scale animation (1 → 1.3 → 1)
  - Spacing: `gap-3`
- Authenticating indicator: Loader2 icon spinning with "Authenticating..." text

**PIN Pad:**
- 3x4 grid layout
- Button size: `h-[80px] sm:h-[90px]`
- Button style: `rounded-2xl bg-white/10 backdrop-blur-md border border-white/5`
- Letter keys (top row):
  - R: Orange color `text-orange-400 active:bg-orange-500/20`
  - B: Indigo color `text-indigo-400 active:bg-indigo-500/20`
  - C: Emerald color `text-emerald-400 active:bg-emerald-500/20`
  - Font size: `text-3xl sm:text-4xl font-bold`
- Number keys (1-9, 0):
  - White text `text-white active:bg-white/20`
  - Font size: `text-3xl sm:text-4xl font-light`
- Bottom row:
  - Staff button: `text-[11px] sm:text-xs font-bold text-white/30 uppercase tracking-wider`, links to `/dashboard/hr/terminal`
  - 0 button: Same as other numbers
  - Delete button: Delete icon `h-6 w-6 sm:h-7 sm:w-7 text-white/40`
- All buttons: `whileTap` scale animation to 0.85, disabled opacity 0.30 when authenticating

**Branding Footer:**
- Bottom of screen
- "Famous Gates Hotels": `text-[10px] text-white font-bold tracking-[0.4em] uppercase`
- "Hirall Systems": `text-[9px] text-white/50 font-mono tracking-widest`
- Opacity: 0.30

---

## 🔧 FUNCTIONALITY

### PIN Format
- 5 characters: 1 letter (R/B/C) + 4 digits
- Example: R0123, B1234, C5678
- Auto-submit when 5 characters entered

### Keyboard Support
- Accepts number keys 0-9
- Accepts letter keys R, B, C (case-insensitive)
- Backspace deletes last character
- Auto-focus on mount for keyboard input

### Login Flow
1. User enters 5-character PIN
2. Auto-submit when complete
3. Call `POST /api/auth/login` with PIN
4. On success:
   - Store JWT in flutter_secure_storage
   - Cache PIN + user data for offline use (desktop only)
   - Route based on role:
     - `cashier` → `/dashboard/cashier`
     - `bartender` → `/dashboard/pos-kitchen?tab=bar`
     - `waiter`/`waitress` → `/dashboard/pos-kitchen?tab=restaurant`
     - `kitchen`/`chef` → `/dashboard/pos-kitchen?tab=kitchen`
     - Default → `/dashboard/pos-kitchen?tab=restaurant`
5. On error: Show toast, clear PIN

### Offline Mode (Desktop Only)
- If offline and in Electron/Tauri:
  - Verify PIN against local cache
  - If cached user found: Allow offline login
  - Show toast: "Offline login: [Name] - Orders will sync when back online"
  - Route to appropriate dashboard
- If no cached user: Show error "PIN not recognized offline"

### Backoffice Button
- Navigate to `/login` (regular backoffice login)
- This is for admin users who need full dashboard access

### Staff Button
- Navigate to `/dashboard/hr/terminal`
- For HR/staff terminal operations

---

## 🎨 COLORS & STYLING

### Color Palette (Match Web App)
```dart
const kTerminalBg = Color(0xFF000000); // Black overlay
const kTerminalText = Color(0xFFFFFFFF); // White text
const kTerminalTextMuted = Color(0x80FFFFFF); // 50% opacity white
const kTerminalTextDim = Color(0x4DFFFFFF); // 30% opacity white
const kTerminalBorder = Color(0x1AFFFFFF); // 10% opacity white
const kTerminalOrange = Color(0xFFFF9F43); // Orange for R key
const kTerminalIndigo = Color(0xFF5C7CFA); // Indigo for B key
const kTerminalEmerald = Color(0xFF2ECC71); // Emerald for C key
const kTerminalGreen = Color(0xFF10B981); // Connected status
const kTerminalAmber = Color(0xFFF59E0B); // Offline status
const kTerminalIndigoBadge = Color(0xFF6366F1); // Pending sync
```

### Typography
- Time: Large, bold, tight tracking
- Labels: Uppercase, wide tracking (0.2em - 0.4em)
- Buttons: Large font size, bold for letters, light for numbers

### Animations
- PIN dots: Scale animation when filled (1 → 1.3 → 1, duration 0.2s)
- Buttons: Scale to 0.85 on tap
- Page load: Fade in with slight Y offset (opacity 0→1, y 20→0, duration 0.8s)
- Sync icon: Slow spin animation

---

## 📁 ASSETS REQUIRED

Copy these assets from the web app to Flutter assets:

```
assets/
├── IMG_8704.JPG          # Background image (from frontend/public/IMG_8704.JPG)
└── fglogo.png            # Famous Gates logo (from frontend/public/fglogo.png - if needed)
```

Update `pubspec.yaml`:
```yaml
flutter:
  assets:
    - assets/IMG_8704.JPG
    - assets/fglogo.png
```

---

## 🏗️ FLUTTER IMPLEMENTATION

### File Structure
```
lib/features/terminal/
├── data/
│   ├── terminal_repository.dart      # API calls for PIN login
│   └── terminal_remote_data_source.dart
├── domain/
│   ├── models/
│   │   └── pin_login_request.dart
│   └── providers/
│       └── terminal_provider.dart   # Riverpod provider
└── presentation/
    └── pages/
        └── terminal_page.dart       # Main terminal screen
```

### Key Dependencies
- `flutter_riverpod` - State management
- `dio` - HTTP client
- `flutter_secure_storage` - JWT storage
- `connectivity_plus` - Online/offline detection
- `phosphor_flutter` - Icons (ShieldCheck, Wifi, WifiOff, RefreshCw, ArrowRight, Delete, Loader2)

### Terminal Page Implementation Notes
- Use `Stack` for background image with overlay
- Use `Positioned` for backoffice button (top-right)
- Use `GridView` for PIN pad (3 columns)
- Use `AnimatedContainer` for PIN dots with scale animation
- Use `GestureDetector` or `InkWell` for button tap effects
- Use `Timer` for clock updates (every 1 second)
- Use `connectivity_plus` for online/offline status
- Use `flutter_secure_storage` for JWT caching

---

## 🌐 API INTEGRATION

### Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

{
  "pin": "R0123"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "cashier",
    "branch_id": 1
  },
  "token": "jwt_token_here"
}
```

### Error Handling
- 401: Invalid PIN - Show error toast, clear PIN
- 503: Service unavailable - Show error toast
- Network error: Switch to offline mode if possible

---

## ✅ ACCEPTANCE CRITERIA

1. **Visual Match:**
   - Background image loads correctly from assets
   - Dark gradient overlay matches web app
   - Backoffice button positioned top-right, hidden on mobile
   - Time/date display matches web app format
   - PIN dots animate correctly when filled
   - PIN pad colors match (R=orange, B=indigo, C=emerald)
   - Branding footer matches web app

2. **Functionality:**
   - PIN entry accepts keyboard input (0-9, R/B/C, backspace)
   - Auto-submits when 5 characters entered
   - Login API call works correctly
   - JWT stored securely
   - Role-based routing works
   - Backoffice button navigates to `/login`
   - Staff button navigates to `/dashboard/hr/terminal`

3. **Offline Mode:**
   - Detects online/offline status
   - Shows correct status badge
   - Offline login works with cached PIN (desktop only)
   - Shows pending sync count when applicable

4. **Responsiveness:**
   - Works on desktop (Windows/Linux)
   - Works on tablet (Android)
   - Backoffice button hidden on small screens
   - Button sizes adapt to screen size

---

## 📌 IMPLEMENTATION ORDER

1. Copy assets (IMG_8704.JPG) to Flutter assets folder
2. Update pubspec.yaml with assets
3. Create terminal data layer (repository, data source)
4. Create terminal domain layer (models, provider)
5. Create terminal page UI (match web app exactly)
6. Implement PIN entry logic
7. Implement login API call
8. Implement role-based routing
9. Add offline mode support
10. Add keyboard support
11. Test on desktop and tablet
12. Verify visual match with web app

---

**Generated:** 2026-05-24  
**Based on:** FamousGate Web App Terminal Page  
**Reference:** `/home/allansamuel/Desktop/fggrill/frontend/src/app/terminal/page.tsx`
