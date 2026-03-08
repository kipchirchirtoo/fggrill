require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testBookingEmailFix() {
  console.log('🧪 Testing booking email fix...\n');

  // Wait for backend to be ready
  console.log('⏳ Waiting for backend to be ready...');
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 10) {
    try {
      await axios.get('http://localhost:5000/api/health');
      ready = true;
      console.log('✅ Backend is ready\n');
    } catch (e) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!ready) {
    console.log('❌ Backend not ready after 10 seconds');
    return;
  }

  // Test 1: Check available rooms for dates without conflicts
  console.log('1️⃣ Checking available rooms for March 20-25, 2026...');
  try {
    const response = await axios.get('http://localhost:5000/api/bookings/available', {
      params: {
        checkIn: '2026-03-20',
        checkOut: '2026-03-25'
      }
    });

    console.log(`✅ Found ${response.data.count} available rooms`);
    
    if (response.data.count > 0) {
      const firstRoom = response.data.data[0];
      console.log(`   First available room: ${firstRoom.room_number} (${firstRoom.type?.name || 'Unknown type'})`);
      console.log(`   Room ID: ${firstRoom.id}`);
      console.log(`   Type ID: ${firstRoom.type_id}`);
      
      // Test 2: Try to create a booking with this room
      console.log('\n2️⃣ Creating test booking...');
      const bookingData = {
        branch_id: firstRoom.branch_id,
        check_in_date: '2026-03-20',
        checkInDate: '2026-03-20',
        check_out_date: '2026-03-25',
        checkOutDate: '2026-03-25',
        room_type_id: firstRoom.type_id,
        room_id: firstRoom.id,
        adults: 2,
        numberOfGuests: 2,
        guestInfo: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com', // Use a test email
          phone: '0700000000'
        },
        bookingSource: 'WEBSITE'
      };

      console.log('   Booking details:', {
        room: firstRoom.room_number,
        dates: '2026-03-20 to 2026-03-25',
        guest: 'Test User',
        email: 'test@example.com'
      });

      const bookingResponse = await axios.post(
        'http://localhost:5000/api/bookings',
        bookingData,
        { timeout: 30000 }
      );

      console.log('✅ Booking created successfully!');
      console.log(`   Confirmation: ${bookingResponse.data.data.confirmationNumber}`);
      console.log(`   Booking ID: ${bookingResponse.data.data.bookingId}`);
      console.log('\n📧 Check backend logs for email sending status');
      console.log('   Look for: "✅ Booking confirmation email sent to test@example.com via Brevo API"');
      
    } else {
      console.log('⚠️ No available rooms found for these dates');
      console.log('   Try different dates or check existing bookings');
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.data.message || error.response.statusText);
      console.log('   Status:', error.response.status);
      if (error.response.data.error) {
        console.log('   Details:', error.response.data.error);
      }
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📝 Summary:');
  console.log('- Email service now uses Brevo API (more reliable)');
  console.log('- Booking validation prevents double-booking (correct behavior)');
  console.log('- Confirmation emails include PDF invoice attachment');
  console.log('='.repeat(60));
}

testBookingEmailFix().catch(console.error);
