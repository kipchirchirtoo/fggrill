# FamousGate Hotels Mobile App - Setup Instructions

## ✅ Project Created Successfully!

The Expo TypeScript project has been initialized with the complete directory structure.

## 📦 Next Steps: Install Dependencies

Run these commands in order from the `famousgate-mobile` directory:

### 1. Install Expo Dependencies
```bash
npx expo install expo-camera expo-barcode-scanner expo-local-authentication expo-notifications expo-secure-store expo-image-picker expo-file-system expo-constants
```

### 2. Install Navigation
```bash
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs @react-navigation/drawer react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
```

### 3. Install State Management & API
```bash
npm install zustand @tanstack/react-query axios socket.io-client
```

### 4. Install WatermelonDB (Offline Database)
```bash
npm install @nozbe/watermelondb @nozbe/with-observables
```

### 5. Install UI & Forms
```bash
npm install react-native-paper react-hook-form zod date-fns
```

### 6. Install PDF Generation
```bash
npm install react-native-pdf-lib
```

### 7. Install Dev Dependencies
```bash
npm install --save-dev @types/react @types/react-native eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## 🔧 Configuration Files Created

The following configuration files have been created:
- ✅ `app.config.ts` - Expo configuration with permissions
- ✅ `.env.development` - Development environment variables
- ✅ `.env.production` - Production environment variables
- ✅ `tsconfig.json` - TypeScript strict configuration
- ✅ `babel.config.js` - Babel with WatermelonDB support
- ✅ `metro.config.js` - Metro bundler configuration

## 📁 Directory Structure Created

```
famousgate-mobile/
├── src/
│   ├── api/              ✅ Created
│   ├── db/               ✅ Created
│   │   ├── models/       ✅ Created
│   │   └── migrations/   ✅ Created
│   ├── sync/             ✅ Created
│   ├── stores/           ✅ Created
│   ├── navigation/       ✅ Created
│   ├── screens/          ✅ Created
│   │   ├── auth/         ✅ Created
│   │   ├── central-store/ ✅ Created
│   │   ├── branch-store/ ✅ Created
│   │   ├── cashier/      ✅ Created
│   │   └── superadmin/   ✅ Created
│   ├── components/       ✅ Created
│   │   ├── common/       ✅ Created
│   │   ├── dispatch/     ✅ Created
│   │   ├── delivery/     ✅ Created
│   │   └── stock/        ✅ Created
│   ├── hooks/            ✅ Created
│   ├── services/         ✅ Created
│   ├── theme/            ✅ Created
│   ├── types/            ✅ Created
│   └── utils/            ✅ Created
└── assets/               ✅ Created
    ├── fonts/            ✅ Created
    ├── images/           ✅ Created
    └── icons/            ✅ Created
```

## 🚀 After Installing Dependencies

1. **Start the development server:**
   ```bash
   npx expo start
   ```

2. **Run on iOS Simulator:**
   ```bash
   npx expo start --ios
   ```

3. **Run on Android Emulator:**
   ```bash
   npx expo start --android
   ```

4. **Run on Physical Device:**
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal

## 📝 Core Files Being Created

The setup will create all necessary files including:
- Database schema and models
- API clients with JWT authentication
- All screen components
- Navigation structure
- Zustand stores
- Sync engine for offline support
- Utility functions and type definitions

## ⚠️ Important Notes

1. **Backend URL**: Update the API_BASE_URL in `.env.development` to point to your backend server
2. **Firebase**: You'll need to configure Firebase Cloud Messaging for push notifications
3. **Permissions**: The app requests Camera, Notifications, and Biometric permissions
4. **Offline Support**: WatermelonDB provides full offline-first functionality

## 🔐 Security Features

- JWT token storage in SecureStore (Keychain/Keystore)
- Biometric authentication (Face ID / Fingerprint)
- 6-digit OTP delivery verification
- Photo evidence for all deliveries
- Audit trail for all actions
- Offline queue with integrity checks

## 📱 Supported Platforms

- ✅ iOS 13.4+
- ✅ Android 6.0+ (API 23+)

## 🎯 Next: Review Generated Files

After dependencies are installed, review the generated files in:
1. `src/db/schema.ts` - Database schema
2. `src/api/client.ts` - API configuration
3. `src/navigation/RootNavigator.tsx` - Role-based routing
4. `src/screens/` - All screen components

## 📞 Support

For issues or questions, refer to:
- Expo Documentation: https://docs.expo.dev/
- React Navigation: https://reactnavigation.org/
- WatermelonDB: https://nozbe.github.io/WatermelonDB/

---

**Status: Project scaffolded successfully! Ready for dependency installation.**
