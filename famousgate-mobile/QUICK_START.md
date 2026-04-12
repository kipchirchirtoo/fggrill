# 🚀 FamousGate Mobile App - Quick Start Guide

## ⚡ Get Started in 5 Minutes

### Step 1: Install Dependencies (2-3 minutes)
```bash
cd famousgate-mobile
npm install
```

### Step 2: Update Backend URL
Edit `.env.development` and set your backend URL:
```
API_BASE_URL=http://YOUR_COMPUTER_IP:5000/api
SOCKET_URL=http://YOUR_COMPUTER_IP:5000
```

**Important**: Use your computer's IP address, not `localhost`, so the mobile device can reach it.

### Step 3: Start the App
```bash
npx expo start
```

### Step 4: Run on Device
- **iOS**: Press `i` or scan QR code with Camera app
- **Android**: Press `a` or scan QR code with Expo Go app
- **Physical Device**: Install Expo Go and scan QR code

---

## 📱 Test the App

### 1. Login Screen
- Email: `admin@famousgate.com`
- Password: (your backend password)

### 2. Role-Based Navigation
The app will automatically route you based on your role:
- `central_storekeeper` → Central Store Dashboard
- `branch_storekeeper` → Branch Store Dashboard
- `cashier` → Cashier Dashboard
- `superadmin` → Admin Dashboard

### 3. Test Barcode Scanning
1. Navigate to any screen with scanning
2. Grant camera permission
3. Point at a barcode
4. See item details appear

---

## 🔧 Troubleshooting

### "Cannot connect to backend"
- Check backend is running: `cd backend && npm run dev`
- Verify IP address in `.env.development`
- Ensure phone and computer are on same WiFi

### "Camera permission denied"
- Go to phone Settings → Apps → Expo Go → Permissions
- Enable Camera permission

### "Module not found"
```bash
npm install
npx expo start --clear
```

### "TypeScript errors"
```bash
npm run type-check
```

---

## 📚 Next Steps

1. **Read Documentation**:
   - `PROJECT_SUMMARY.md` - Overview
   - `IMPLEMENTATION_GUIDE.md` - Code examples
   - `SETUP_INSTRUCTIONS.md` - Detailed setup

2. **Implement Features**:
   - Start with Priority 1 (Database & API)
   - Follow the implementation order
   - Test each feature as you build

3. **Backend Integration**:
   - Ensure all API endpoints are implemented
   - Test OTP generation and verification
   - Verify photo upload works

---

## 🎯 Development Workflow

```bash
# Start development
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Clear cache
npx expo start --clear

# Type check
npm run type-check

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

---

## 📦 Build for Production

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

---

## ✅ Checklist

- [ ] Dependencies installed
- [ ] Backend URL configured
- [ ] App starts without errors
- [ ] Can login successfully
- [ ] Role routing works
- [ ] Camera permission granted
- [ ] Barcode scanning works

---

**Ready to build!** 🎉

For detailed implementation, see `IMPLEMENTATION_GUIDE.md`
