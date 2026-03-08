/**
 * Test Landing Page Search Flow
 * This script tests the complete search flow to diagnose the "view room option" issue
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testSearchFlow() {
  console.log('🔍 Testing Landing Page Search Flow\n');

  try {
    // Step 1: Test API Health
    console.log('Step 1: Testing API Health...');
    const healthRes = await axios.get(`${API_BASE}/health`);
    console.log('✓ API is healthy:', healthRes.data);
    console.log('');

    // Step 2: Fetch Branches
    console.log('Step 2: Fetching branches...');
    const branchesRes = await axios.get(`${API_BASE}/system/branches`);
    const branches = branchesRes.data.data || branchesRes.data;
    console.log(`✓ Found ${branches.length} branches`);
    branches.forEach(b => {
      console.log(`  - ${b.name} (ID: ${b.id}, Status: ${b.status})`);
    });
    console.log('');

    // Step 3: Search for available rooms
    const branchId = branches[0]?.id || '2';
    const checkIn = '2026-03-10';
    const checkOut = '2026-03-12';

    console.log(`Step 3: Searching for rooms at branch ${branchId}...`);
    console.log(`  Check-in: ${checkIn}`);
    console.log(`  Check-out: ${checkOut}`);

    const searchRes = await axios.get(`${API_BASE}/bookings/available`, {
      params: {
        branch_id: branchId,
        checkIn: checkIn,
        checkOut: checkOut
      }
    });

    console.log('Raw response:', JSON.stringify(searchRes.data, null, 2));

    const rooms = searchRes.data.data || searchRes.data;
    console.log(`\n✓ Found ${Array.isArray(rooms) ? rooms.length : 0} available rooms`);

    if (Array.isArray(rooms) && rooms.length > 0) {
      console.log('\nRoom Details:');
      rooms.forEach((room, i) => {
        console.log(`\n  Room ${i + 1}:`);
        console.log(`    ID: ${room.id}`);
        console.log(`    Number: ${room.room_number}`);
        console.log(`    Type ID: ${room.type_id}`);
        console.log(`    Status: ${room.status}`);
        console.log(`    Type Info: ${room.type ? JSON.stringify(room.type) : 'NOT INCLUDED'}`);
      });

      // Step 4: Test if we can book one of these rooms
      console.log('\n\nStep 4: Testing booking validation...');
      const testRoom = rooms[0];
      console.log(`  Attempting to book room ${testRoom.room_number} (ID: ${testRoom.id})`);
      console.log(`  Room Type ID: ${testRoom.type_id}`);

      try {
        const bookingPayload = {
          branch_id: branchId,
          branchId: branchId,
          check_in_date: checkIn,
          checkInDate: checkIn,
          check_out_date: checkOut,
          checkOutDate: checkOut,
          room_type_id: testRoom.type_id,
          roomTypeId: testRoom.type_id,
          room_id: testRoom.id,
          roomId: testRoom.id,
          adults: 1,
          numberOfGuests: 1,
          children: 0,
          guestInfo: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '0700000000'
          },
          bookingSource: 'WEBSITE',
          paymentMethod: 'cash'
        };

        console.log('\n  Booking payload:', JSON.stringify(bookingPayload, null, 2));

        const bookingRes = await axios.post(`${API_BASE}/bookings`, bookingPayload);
        console.log('\n✓ Booking successful!');
        console.log('  Confirmation:', bookingRes.data);
      } catch (bookingErr) {
        if (bookingErr.response) {
          console.log('\n✗ Booking failed with status:', bookingErr.response.status);
          console.log('  Error:', bookingErr.response.data);
        } else {
          console.log('\n✗ Booking failed:', bookingErr.message);
        }
      }
    } else {
      console.log('\n✗ No rooms available to test booking');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testSearchFlow();
