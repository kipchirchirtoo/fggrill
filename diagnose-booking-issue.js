require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseBookingIssue() {
  console.log('🔍 Diagnosing booking issue...\n');

  // Test data from the error log
  const roomId = 'c9849e6a-573c-42f0-86cf-8db1e6c7539b';
  const checkIn = '2026-03-09';
  const checkOut = '2026-03-17';
  const roomTypeId = 'e66676c9-0289-4ef8-bdf1-27869b339611';

  // 1. Check if room exists
  console.log('1️⃣ Checking if room exists...');
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError) {
    console.log('❌ Room not found:', roomError.message);
    return;
  }

  console.log('✅ Room found:', {
    id: room.id,
    room_number: room.room_number,
    status: room.status,
    type_id: room.type_id,
    branch_id: room.branch_id
  });

  // 2. Check for existing bookings
  console.log('\n2️⃣ Checking for existing bookings...');
  const { data: bookings, error: bookingsError } = await supabase
    .from('reservations')
    .select('*')
    .eq('room_id', roomId)
    .not('status', 'in', '(cancelled,checked_out)')
    .lt('check_in_date', checkOut)
    .gt('check_out_date', checkIn);

  if (bookingsError) {
    console.log('❌ Error checking bookings:', bookingsError.message);
  } else if (bookings && bookings.length > 0) {
    console.log('⚠️ Room has existing bookings:', bookings.length);
    bookings.forEach(b => {
      console.log(`   - Booking ${b.confirmation_number}: ${b.check_in_date} to ${b.check_out_date} (${b.status})`);
    });
  } else {
    console.log('✅ No conflicting bookings found');
  }

  // 3. Check availability query (what the backend does)
  console.log('\n3️⃣ Running availability check (backend logic)...');
  
  // Find booked rooms
  const { data: booked } = await supabase
    .from('reservations')
    .select('room_id')
    .not('status', 'in', '(cancelled,checked_out)')
    .lt('check_in_date', checkOut)
    .gt('check_out_date', checkIn);

  const bookedIds = (booked || []).map(b => b.room_id);
  console.log(`   Booked room IDs: ${bookedIds.length} rooms`);

  // Query available rooms (with specific roomTypeId filter)
  let roomQuery = supabase
    .from('rooms')
    .select('*')
    .in('status', ['available', 'cleaning'])
    .eq('type_id', roomTypeId); // This is the issue - filtering by type when specific room requested

  if (bookedIds.length > 0) {
    const bookedIdsList = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
    roomQuery = roomQuery.not('id', 'in', bookedIdsList);
  }

  const { data: availableRooms, error: availError } = await roomQuery;

  if (availError) {
    console.log('❌ Error checking availability:', availError.message);
  } else {
    console.log(`✅ Available rooms found: ${availableRooms?.length || 0}`);
    const requestedRoomAvailable = availableRooms?.find(r => r.id === roomId);
    if (requestedRoomAvailable) {
      console.log('✅ Requested room IS in available list');
    } else {
      console.log('❌ Requested room NOT in available list');
      console.log('   Reason: Room type filter or status filter excluded it');
    }
  }

  // 4. Check without roomTypeId filter (what should happen)
  console.log('\n4️⃣ Running availability check WITHOUT roomTypeId filter...');
  
  let roomQueryNoType = supabase
    .from('rooms')
    .select('*')
    .in('status', ['available', 'cleaning']);

  if (bookedIds.length > 0) {
    const bookedIdsList = `(${bookedIds.map(id => `"${id}"`).join(',')})`;
    roomQueryNoType = roomQueryNoType.not('id', 'in', bookedIdsList);
  }

  const { data: availableRoomsNoType } = await roomQueryNoType;
  console.log(`✅ Available rooms found: ${availableRoomsNoType?.length || 0}`);
  const requestedRoomAvailableNoType = availableRoomsNoType?.find(r => r.id === roomId);
  if (requestedRoomAvailableNoType) {
    console.log('✅ Requested room IS in available list (without type filter)');
  } else {
    console.log('❌ Requested room NOT in available list (even without type filter)');
  }

  // 5. Summary
  console.log('\n📊 DIAGNOSIS SUMMARY:');
  console.log('='.repeat(60));
  if (room.status !== 'available' && room.status !== 'cleaning') {
    console.log('❌ ISSUE: Room status is not "available" or "cleaning"');
    console.log(`   Current status: ${room.status}`);
  } else if (bookings && bookings.length > 0) {
    console.log('❌ ISSUE: Room has conflicting bookings');
  } else if (!requestedRoomAvailable && requestedRoomAvailableNoType) {
    console.log('❌ ISSUE: Room type filter is excluding the requested room');
    console.log(`   Room type: ${room.type_id}`);
    console.log(`   Requested type: ${roomTypeId}`);
    console.log('   FIX: When roomId is provided, do NOT filter by roomTypeId');
  } else {
    console.log('✅ Room should be available - check backend logic');
  }
}

diagnoseBookingIssue().catch(console.error);
