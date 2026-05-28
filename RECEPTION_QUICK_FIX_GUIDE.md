# Reception Module - Quick Fix Guide

## Property Name Corrections

Run these find-and-replace operations across all new reception screens:

### 1. Booking Model Properties

```bash
cd famous_gates_app/lib/features/reception/presentation/screens

# Fix date properties
sed -i 's/booking\.checkInDate/booking.checkIn/g' *.dart
sed -i 's/booking\.checkOutDate/booking.checkOut/g' *.dart

# Fix amount properties  
sed -i 's/booking\.depositAmount/booking.amountPaid/g' *.dart

# Fix guest properties
sed -i 's/booking\.adults/booking.raw["adults"]/g' *.dart
sed -i 's/booking\.children/booking.raw["children"]/g' *.dart
```

### 2. Room Model Properties

```bash
# Fix room number (int to String)
sed -i 's/room\.roomNumber/"\${room.number}"/g' *.dart

# Fix room type
sed -i 's/room\.roomType/room.type/g' *.dart

# Fix floor number
sed -i 's/room\.floorNumber/room.floor/g' *.dart

# Fix price
sed -i 's/room\.pricePerNight/room.pricePerNight/g' *.dart  # Already correct

# Fix max occupancy
sed -i 's/room\.maxOccupancy/room.raw["max_occupancy"]/g' *.dart

# Fix clean status
sed -i 's/room\.isClean/room.raw["is_clean"]/g' *.dart
```

### 3. Add Missing Booking Properties

Since `adults`, `children`, `infants` are not in the Booking model, access via `raw`:

```dart
// In check_in_screen.dart and check_out_screen.dart
final adults = booking.raw['adults'] ?? 1;
final children = booking.raw['children'] ?? 0;
final infants = booking.raw['infants'] ?? 0;
```

### 4. Fix Nullable String Operations

```bash
# Fix toLowerCase on nullable strings
sed -i 's/\.confirmationNumber\.toLowerCase()/\.confirmationNumber?.toLowerCase() ?? ""/g' *.dart
sed -i 's/\.guestName\.toLowerCase()/\.guestName?.toLowerCase() ?? ""/g' *.dart
```

### 5. Fix Room ID Nullable Issues

```dart
// In check_in_screen.dart and check_out_screen.dart
if (_selectedBooking!.roomId != null && _selectedBooking!.roomId!.isNotEmpty) {
  await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'occupied');
}
```

## Add Missing Package

```bash
cd famous_gates_app

# Add file_picker for document uploads
flutter pub add file_picker

# Then uncomment the file picker code in check_in_screen.dart
```

## Automated Fix Script

Create `fix_reception_screens.sh`:

```bash
#!/bin/bash
cd famous_gates_app/lib/features/reception/presentation/screens

# Booking date properties
find . -name "*.dart" -exec sed -i 's/booking\.checkInDate/booking.checkIn/g' {} +
find . -name "*.dart" -exec sed -i 's/booking\.checkOutDate/booking.checkOut/g' {} +

# Booking amount properties
find . -name "*.dart" -exec sed -i 's/booking\.depositAmount/booking.amountPaid/g' {} +

# Room properties
find . -name "*.dart" -exec sed -i 's/room\.roomNumber/"\${room.number}"/g' {} +
find . -name "*.dart" -exec sed -i 's/room\.roomType/room.type ?? ""/g' {} +
find . -name "*.dart" -exec sed -i 's/room\.floorNumber/room.floor ?? 0/g' {} +

# Nullable string operations
find . -name "*.dart" -exec sed -i 's/\.confirmationNumber\.toLowerCase()/\.confirmationNumber?.toLowerCase() ?? ""/g' {} +
find . -name "*.dart" -exec sed -i 's/\.guestName\.toLowerCase()/\.guestName?.toLowerCase() ?? ""/g' {} +

echo "✅ Property names fixed!"
echo "⚠️  Manual fixes still needed:"
echo "   1. Replace booking.adults/children with booking.raw['adults']"
echo "   2. Add null checks for roomId before updateRoomStatus calls"
echo "   3. Run 'flutter analyze' to verify"
```

## Manual Fixes Required

### 1. Guest/Occupancy Properties

In `check_in_screen.dart` and `check_out_screen.dart`, replace:

```dart
// OLD
_infoRow('Guests', '${booking.adults} Adults, ${booking.children} Children'),

// NEW
_infoRow('Guests', '${booking.raw["adults"] ?? 1} Adults, ${booking.raw["children"] ?? 0} Children'),
```

### 2. Room Status Updates

In `check_in_screen.dart`:

```dart
// OLD
await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'occupied');

// NEW
if (_selectedBooking!.roomId != null && _selectedBooking!.roomId!.isNotEmpty) {
  await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'occupied');
}
```

In `check_out_screen.dart`:

```dart
// OLD
await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'cleaning');

// NEW
if (_selectedBooking!.roomId != null && _selectedBooking!.roomId!.isNotEmpty) {
  await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'cleaning');
}
```

### 3. Room Model Access

In `create_reservation_screen.dart`, update room card display:

```dart
// OLD
Text('Room ${room.roomNumber}'),
subtitle: Text('${room.roomType} • KES ${room.pricePerNight}/night'),

// NEW
Text('Room ${room.number}'),
subtitle: Text('${room.type ?? "Standard"} • KES ${room.pricePerNight ?? 0}/night'),
```

### 4. Remove Unused Fields

In `check_in_screen.dart` and `check_out_screen.dart`:

```dart
// Remove these unused fields (they trigger warnings)
// double _paymentAmount = 0;
// String _paymentMethod = 'Cash';

// Only keep them if you implement payment collection
```

## Verification Steps

```bash
cd famous_gates_app

# 1. Run analyzer
flutter analyze lib/features/reception/presentation/screens/

# 2. Expected output: 0 errors, 0 warnings

# 3. Build test
flutter build apk --debug --target-platform android-arm64

# 4. Run on device/emulator
flutter run -d <device-id>
```

## Testing Checklist

After fixes:

- [ ] Create Reservation Screen
  - [ ] Room search loads available rooms
  - [ ] Pricing calculation works
  - [ ] Booking creation succeeds
  
- [ ] Check-In Screen
  - [ ] Search finds confirmed bookings
  - [ ] Booking details display correctly
  - [ ] Check-in updates room status
  
- [ ] Check-Out Screen
  - [ ] Search finds checked-in guests
  - [ ] Folio loads and displays
  - [ ] Check-out updates room status
  
- [ ] Guest Management Screen
  - [ ] Guest list loads
  - [ ] Filters work (All, VIP, Blacklisted)
  - [ ] Create guest succeeds
  
- [ ] Room Management Screen
  - [ ] Room grid displays
  - [ ] Status filters work
  - [ ] Room status updates succeed
  
- [ ] Housekeeping Screen
  - [ ] Tasks load and display
  - [ ] Rooms load and display
  - [ ] Task status updates work

## Common Errors & Solutions

### Error: "The getter 'depositAmount' isn't defined"
**Fix**: Replace with `amountPaid`

### Error: "The getter 'checkInDate' isn't defined"
**Fix**: Replace with `checkIn`

### Error: "The getter 'roomNumber' isn't defined"
**Fix**: Replace with `number` (and convert to String: `"${room.number}"`)

### Error: "The method 'toLowerCase' can't be unconditionally invoked"
**Fix**: Use null-aware operator: `?.toLowerCase() ?? ""`

### Error: "The argument type 'String?' can't be assigned to 'String'"
**Fix**: Add null check or use `!` operator if you're certain it's not null

### Error: "3 positional arguments expected by 'ReceptionRepository.new'"
**Fix**: Already fixed - using `ref.read(receptionRepositoryProvider)`

## Quick Test Command

```bash
# Test all screens compile
cd famous_gates_app
flutter analyze lib/features/reception/presentation/screens/create_reservation_screen.dart
flutter analyze lib/features/reception/presentation/screens/check_in_screen.dart
flutter analyze lib/features/reception/presentation/screens/check_out_screen.dart
flutter analyze lib/features/reception/presentation/screens/guest_management_screen.dart
flutter analyze lib/features/reception/presentation/screens/room_management_screen.dart
flutter analyze lib/features/reception/presentation/screens/housekeeping_screen.dart
```

## Integration with Dashboard

To wire these screens into the reception dashboard, update `reception_dashboard.dart`:

```dart
// Add navigation handlers
void _navigateToCreateReservation() {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const CreateReservationScreen()),
  );
}

void _navigateToCheckIn([Booking? booking]) {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => CheckInScreen(booking: booking)),
  );
}

void _navigateToCheckOut([Booking? booking]) {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => CheckOutScreen(booking: booking)),
  );
}

void _navigateToGuests() {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const GuestManagementScreen()),
  );
}

void _navigateToRooms() {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const RoomManagementScreen()),
  );
}

void _navigateToHousekeeping() {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const HousekeepingScreen()),
  );
}
```

---

**Estimated Fix Time**: 30-45 minutes  
**Priority**: High (screens are 95% complete, just need property alignment)
