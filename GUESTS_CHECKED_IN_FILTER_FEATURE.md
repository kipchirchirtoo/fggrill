# Guests Page - Checked-In Filter Feature

## Feature Added
The Guests page now shows only checked-in guests by default and includes filtering options.

## Changes Made

### 1. Added State Management
```typescript
const [filterCheckedIn, setFilterCheckedIn] = useState(true); // Default to checked-in
const [activeBookings, setActiveBookings] = useState<any[]>([]);
```

### 2. Fetch Active Bookings
The page now fetches bookings with status `checked_in` or `checked-in`:
```typescript
const bookingsResponse = await bookingsAPI.getBookings();
const checkedInBookings = (bookingsResponse.data || []).filter(
  (b: any) => b.status === 'checked_in' || b.status === 'checked-in'
);
setActiveBookings(checkedInBookings);
```

### 3. Filter Logic
Guests are filtered based on their check-in status:
```typescript
const filteredGuests = guests.filter((guest) => {
  // VIP filter
  if (filterVIP !== null && guest.isVip !== filterVIP) return false;
  
  // Checked-in filter
  if (filterCheckedIn !== null) {
    const isCheckedIn = activeBookings.some(
      (booking) => booking.guest_id === guest.id || booking.guestId === guest.id
    );
    if (filterCheckedIn && !isCheckedIn) return false;
    if (!filterCheckedIn && isCheckedIn) return false;
  }
  
  return true;
});
```

### 4. Updated Stats Card
Changed "Returning Guests" to "Checked In" count:
```typescript
{ label: 'Checked In', value: activeBookings.length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' }
```

### 5. New Filter Buttons
Added filter buttons above the table:
- **All** - Shows all guests
- **Checked In** (default) - Shows only checked-in guests
- **VIP** - Toggle VIP filter

### 6. Visual Indicators
Checked-in guests now have:
- **Green avatar** instead of dark gray
- **Check icon badge** on avatar
- **"In-House" badge** next to name
- **Room number** displayed instead of nationality

## UI Changes

### Filter Buttons
```
[All] [✓ Checked In] [★ VIP]
```

### Guest Row (Checked-In)
```
┌─────────────────────────────────────────┐
│ [GU✓] Guest Name [In-House]            │
│       Room 101                          │
└─────────────────────────────────────────┘
```

### Guest Row (Not Checked-In)
```
┌─────────────────────────────────────────┐
│ [GU] Guest Name                         │
│      Kenyan                             │
└─────────────────────────────────────────┘
```

## Default Behavior

When the page loads:
1. ✅ Fetches all guests
2. ✅ Fetches all checked-in bookings
3. ✅ Filters to show only checked-in guests by default
4. ✅ Shows "Checked In" count in stats
5. ✅ Highlights checked-in guests with green avatars

## User Actions

### View All Guests
Click "All" button to see all guests (checked-in and not checked-in)

### View Only Checked-In
Click "Checked In" button (default state)

### Combine Filters
- Click "Checked In" + "VIP" to see only VIP guests who are checked in
- Click "All" + "VIP" to see all VIP guests

## Benefits

✅ **Quick Access** - Receptionists see in-house guests immediately
✅ **Visual Clarity** - Green avatars and badges make it obvious
✅ **Room Info** - Shows room number for checked-in guests
✅ **Flexible Filtering** - Can still view all guests when needed
✅ **Better Stats** - Shows count of currently checked-in guests

## Testing

1. **Load Page**
   - Should show only checked-in guests by default
   - "Checked In" button should be highlighted

2. **Click "All"**
   - Should show all guests
   - "All" button should be highlighted

3. **Click "Checked In"**
   - Should filter back to checked-in guests only

4. **Check Visual Indicators**
   - Checked-in guests have green avatars
   - "In-House" badge appears
   - Room number shows instead of nationality

5. **Combine Filters**
   - Click "Checked In" + "VIP"
   - Should show only VIP guests who are checked in

## Files Modified

- ✅ `frontend/src/app/dashboard/reception/guests/page.tsx`
  - Added checked-in filter state
  - Fetch active bookings
  - Filter logic for checked-in status
  - Visual indicators for in-house guests
  - Updated filter buttons
  - Updated stats card

## Status

✅ **COMPLETE** - Guests page now defaults to showing checked-in guests with clear visual indicators!
