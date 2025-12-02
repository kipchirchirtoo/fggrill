# Hotel Receptionist Module - Testing Guide

## 🚀 Quick Start

### 1. Start Backend Server
```bash
cd /home/john/fggrill/backend
npm install
npm run dev
```
Expected output: `Server running on port 5000`

### 2. Start Frontend Server
```bash
cd /home/john/fggrill/frontend
npm install
npm run dev
```
Expected output: `Ready on http://localhost:3000`

## ✅ Test Scenarios

### Test 1: New Reservation with Guest Search
**Objective**: Create a reservation by searching for an existing guest

**Steps:**
1. Navigate to Reception Dashboard
2. Click "New Reservation" button
3. **Step 1 - Guest Search:**
   - Enter a guest name/email in search box (e.g., "john@example.com")
   - Click "Search" button
   - If guest exists: Click on guest from results dropdown
   - Verify form auto-fills with guest information
   - Click "Next"

4. **Step 2 - Stay Details:**
   - Select Check-in date (today or future)
   - Select Check-out date (after check-in)
   - Select Room Type from dropdown
   - Set Adults count (default: 1)
   - Set Children count (default: 0)
   - Add Special Requests (optional)
   - Click "Next"

5. **Step 3 - Room Selection:**
   - Wait for available rooms to load
   - Review room cards showing: room number, type, floor, price
   - Click on desired room card (border turns blue)
   - Verify "Selected Room" badge appears
   - Click "Create Reservation"

**Expected Result:**
- Success toast: "Reservation created successfully!"
- Modal closes
- Dashboard updates with new reservation
- Real-time stats refresh

---

### Test 2: New Reservation with New Guest
**Objective**: Create a reservation for a guest not in the system

**Steps:**
1. Click "New Reservation"
2. **Step 1:**
   - Search for non-existent guest (e.g., "newguest@test.com")
   - See "No guest found" toast
   - Manually fill in:
     - Full Name: "Jane Doe"
     - Email: "jane.doe@test.com"
     - Phone: "+254712345678"
   - Click "Next"

3. **Step 2:** (Same as Test 1)
4. **Step 3:** (Same as Test 1)

**Expected Result:**
- New guest created automatically
- Reservation created with new guest
- Guest now searchable in future reservations

---

### Test 3: Check-In Flow
**Objective**: Check in a confirmed reservation

**Steps:**
1. Navigate to Reception Dashboard
2. Click "Check In" button
3. Search for booking by confirmation number or guest name
4. Click on booking from results
5. Verify guest and room details
6. Select Payment Method
7. Enter Amount Paid
8. Click "Complete Check-In"

**Expected Result:**
- Success toast: "Guest checked in successfully!"
- Room status changes to "Occupied"
- Booking status changes to "Checked In"
- Dashboard "Checked In" count increases

---

### Test 4: Check-Out Flow
**Objective**: Check out a guest and settle the bill

**Steps:**
1. Click "Check Out" button
2. Search for checked-in guest
3. Select guest from results
4. Review folio balance
5. Enter payment details if balance > 0
6. Click "Complete Check-Out"

**Expected Result:**
- Success toast: "Guest checked out successfully!"
- Room status changes to "Vacant - Dirty"
- Booking status changes to "Checked Out"
- Folio status changes to "Closed"

---

### Test 5: Real-time Dashboard Updates
**Objective**: Verify Supabase realtime subscriptions work

**Steps:**
1. Open two browser windows with Reception Dashboard
2. In Window 1: Create a new reservation
3. In Window 2: Verify stats update automatically
4. In Window 1: Check in a guest
5. In Window 2: Verify room status updates

**Expected Result:**
- Dashboard in Window 2 refreshes without manual reload
- Stats counters update in real-time
- Room status changes reflect immediately

---

## 🐛 Common Issues & Solutions

### Issue 1: "Failed to load room types"
**Cause**: Backend not running or database connection issue
**Solution**:
```bash
# Check backend is running
curl http://localhost:5000/api/rooms/types

# Verify Supabase credentials in backend/.env
SUPABASE_PROJECT_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Issue 2: "No available rooms" in Step 3
**Cause**: All rooms booked for selected dates
**Solution**:
- Try different dates
- Check database for existing reservations
- Verify room status (should be "available" or "vacant")

### Issue 3: Guest search returns no results
**Cause**: No guests in database
**Solution**:
- Create a test guest manually via Guest Management
- Or proceed with new guest creation in reservation flow

### Issue 4: Modal freezes on submit
**Cause**: API error or missing fields
**Solution**:
- Open browser console (F12) for error details
- Check backend logs for API errors
- Verify all required fields are filled

---

## 📊 Database Verification

### Check Created Reservation
```sql
SELECT 
  r.confirmation_number,
  r.status,
  g.first_name,
  g.last_name,
  rm.room_number,
  rt.name as room_type
FROM reservations r
JOIN guests g ON r.guest_id = g.id
JOIN rooms rm ON r.room_id = rm.id
JOIN room_types rt ON r.room_type_id = rt.id
ORDER BY r.created_at DESC
LIMIT 5;
```

### Check Guest Creation
```sql
SELECT * FROM guests 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Folio Balance
```sql
SELECT 
  f.id,
  f.total_charges,
  f.total_payments,
  f.balance,
  f.status,
  r.confirmation_number
FROM folios f
JOIN reservations r ON f.reservation_id = r.id
ORDER BY f.created_at DESC
LIMIT 5;
```

---

## 🎯 Key Features to Test

### ReservationModal (3-Step Wizard)
- ✅ Progress bar updates (33%, 66%, 100%)
- ✅ Guest search autocomplete
- ✅ Guest selection auto-fills form
- ✅ Dynamic room type dropdown
- ✅ Available rooms filtered by type and dates
- ✅ Room selection visual feedback
- ✅ Previous/Next/Submit navigation
- ✅ Validation on each step
- ✅ Loading states and spinners
- ✅ Toast notifications

### CheckInModal
- ✅ Search confirmed bookings
- ✅ Display guest and room details
- ✅ Payment method selection
- ✅ Amount paid input
- ✅ Check-in API integration

### CheckOutModal
- ✅ Search checked-in guests
- ✅ Fetch and display folio balance
- ✅ Payment processing
- ✅ Check-out API integration

### Dashboard Real-time
- ✅ Stats auto-refresh on changes
- ✅ Room status updates
- ✅ Arrivals/departures lists update
- ✅ Supabase subscription active

---

## 📝 Test Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend server running on port 3000
- [ ] Supabase credentials configured
- [ ] Database migration applied
- [ ] User authenticated and logged in
- [ ] New reservation flow (existing guest) - PASS/FAIL
- [ ] New reservation flow (new guest) - PASS/FAIL
- [ ] Guest search autocomplete - PASS/FAIL
- [ ] Room type dropdown loads - PASS/FAIL
- [ ] Available rooms display correctly - PASS/FAIL
- [ ] Room selection works - PASS/FAIL
- [ ] Check-in flow complete - PASS/FAIL
- [ ] Check-out flow complete - PASS/FAIL
- [ ] Real-time updates working - PASS/FAIL
- [ ] All modals close properly - PASS/FAIL
- [ ] Error handling and toasts - PASS/FAIL

---

## 🎥 Screen Recording Tips

If recording a demo:
1. **Start with Dashboard Overview**: Show stats and room status
2. **Create Reservation**: Walk through all 3 steps slowly
3. **Show Search Feature**: Demo guest search autocomplete
4. **Show Room Selection**: Display the room grid and selection
5. **Check Real-time**: Open two windows to show live updates
6. **Complete Full Flow**: Reservation → Check-in → Check-out

---

**Happy Testing! 🎉**

For issues or questions, check:
- Backend logs: `cd backend && npm run dev`
- Frontend console: Browser DevTools (F12)
- Database: Supabase Dashboard
