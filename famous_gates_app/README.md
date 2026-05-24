# Famous Gates Hotel & Restaurant App

A production-grade, cross-platform Flutter application for hotel and restaurant operations.

## Tech Stack
- **Framework:** Flutter 3.x
- **State Management:** Riverpod 2.x
- **Database:** Drift (SQLite)
- **Networking:** Dio
- **Navigation:** GoRouter

## Project Structure
- `lib/core/`: Application core (theme, network, router, database)
- `lib/features/`: Feature modules by domain (auth, pos, restaurant, etc.)
- `lib/services/`: Background services (sync, printing)

## Environment Variables
The following `--dart-define` values are supported:
- `MAIN_API_URL`: Base URL for the main API (default: https://api.hirall.com)
- `PYTHON_SERVICES_URL`: Base URL for Python microservices (default: https://services.hirall.com)

## Build Instructions

### Windows
```bash
flutter build windows --release
```

### Linux
```bash
flutter build linux --release
```

### Android
```bash
flutter build apk --release --target-platform android-arm64
```

## Setup
1. Run `flutter pub get`
2. Run `flutter pub run build_runner build`
3. Run the app on your preferred platform.
