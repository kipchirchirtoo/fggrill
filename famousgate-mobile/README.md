# FamousGate Hotels Mobile App

React Native mobile application for FamousGate Hotels staff, built with Expo.

## Features

### Role-Based Access
- **Central Storekeeper**: Manage central inventory, create dispatches, track stock
- **Branch Storekeeper**: Receive deliveries, manage branch stock, raise requisitions
- **Cashier**: Process payments, scan receipts, manage shifts
- **Superadmin**: Monitor all operations, manage users, view analytics

### Key Functionality
- 📱 Barcode/QR code scanning for receipts and inventory
- 🔐 Secure authentication with JWT tokens
- 📦 Real-time delivery tracking
- 💰 Multiple payment methods (Cash, M-Pesa, Card)
- 📊 Dashboard analytics for each role
- 🔔 Push notifications for important events
- 🔒 Biometric authentication support
- 📴 Offline-first architecture with sync

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation v6
- **State Management**: Zustand
- **UI Components**: React Native Paper
- **Forms**: React Hook Form + Zod
- **API Client**: Axios
- **Local Storage**: Expo SecureStore, AsyncStorage
- **Camera**: Expo Camera
- **Notifications**: Expo Notifications
- **Biometrics**: Expo Local Authentication

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode and iOS Simulator
- For Android: Android Studio and Android Emulator
- Physical device with Expo Go app (recommended for testing)

## Installation

1. **Install dependencies**:
   ```bash
   cd famousgate-mobile
   npm install
   ```

2. **Configure environment**:
   - Copy `.env.development` and update the API base URL
   - Set `REACT_NATIVE_PACKAGER_HOSTNAME` to your local IP address

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on device/simulator**:
   - Scan QR code with Expo Go app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

## Project Structure

```
src/
├── api/              # API client and endpoints
│   ├── auth.api.ts
│   ├── cashier.api.ts
│   ├── dispatch.api.ts
│   ├── inventory.api.ts
│   └── ...
├── components/       # Reusable components
│   ├── common/       # Shared UI components
│   ├── delivery/     # Delivery-specific components
│   ├── dispatch/     # Dispatch-specific components
│   └── stock/        # Stock management components
├── navigation/       # Navigation configuration
│   └── RootNavigator.tsx
├── screens/          # Screen components by role
│   ├── auth/
│   ├── branch-store/
│   ├── cashier/
│   ├── central-store/
│   └── superadmin/
├── services/         # Business logic services
│   ├── biometric.service.ts
│   ├── notification.service.ts
│   └── storage.service.ts
├── stores/           # Zustand state stores
│   └── auth.store.ts
├── theme/            # Theme configuration
│   ├── colors.ts
│   ├── typography.ts
│   └── index.ts
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
│   ├── formatters.ts
│   ├── validation.ts
│   └── errorHandler.ts
└── App.tsx           # App entry point
```

## User Roles & Workflows

### Central Storekeeper
1. Login → Central Store Dashboard
2. Create dispatch to branch
3. Generate OTP for delivery verification
4. Track dispatch status
5. Manage central inventory
6. Log waste and perform stock takes

### Branch Storekeeper
1. Login → Branch Store Dashboard
2. View pending deliveries
3. Enter OTP to verify delivery
4. Count received items
5. Report discrepancies if needed
6. Manage branch stock
7. Raise requisitions to central store

### Cashier
1. Login → Cashier Dashboard
2. Start shift
3. Scan customer receipt barcode
4. View bill details
5. Process payment (Cash/M-Pesa/Card)
6. End shift and view summary

### Superadmin
1. Login → Admin Dashboard
2. Monitor live deliveries across all branches
3. View discrepancy alerts
4. Manage users and permissions
5. Access audit logs
6. Override OTP in emergencies

## API Integration

The app connects to the FamousGate Hotels backend API. Configure the base URL in `.env.development`:

```env
API_BASE_URL=http://192.168.1.100:5000/api
```

### Authentication
- JWT tokens stored in Expo SecureStore
- Auto-refresh on 401 responses
- Biometric authentication option

### Endpoints Used
- `POST /api/auth/login` - User authentication
- `GET /api/cashier/*` - Cashier operations
- `GET /api/storekeeping/*` - Inventory and dispatch management
- `POST /api/payments/mpesa/*` - M-Pesa integration
- `GET /api/system/*` - System data (branches, users)

## Development

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Type Checking
```bash
npm run type-check
```

### Building for Production

**iOS**:
```bash
eas build --platform ios
```

**Android**:
```bash
eas build --platform android
```

## Environment Variables

Create `.env.development` and `.env.production`:

```env
# API Configuration
API_BASE_URL=http://localhost:5000/api

# Expo Configuration
EXPO_PUBLIC_API_URL=http://localhost:5000/api

# EAS Project ID (for push notifications)
EAS_PROJECT_ID=your-project-id
```

## Troubleshooting

### Metro Bundler Issues
```bash
npm start -- --clear
```

### iOS Simulator Not Opening
```bash
npx expo start --ios
```

### Android Build Errors
```bash
cd android && ./gradlew clean
cd .. && npm start
```

### Network Errors
- Ensure backend is running
- Check firewall settings
- Verify IP address in environment config
- Use `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find local IP

## Features to Implement

- [ ] Offline mode with local database (WatermelonDB)
- [ ] Real-time updates via WebSocket
- [ ] QR code generation for receipts
- [ ] PDF report generation
- [ ] Image capture for waste logs
- [ ] Signature capture for deliveries
- [ ] Multi-language support
- [ ] Dark mode theme

## Contributing

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and test thoroughly
3. Commit: `git commit -m "Add new feature"`
4. Push: `git push origin feature/new-feature`
5. Create Pull Request

## License

Proprietary - FamousGate Hotels © 2024
