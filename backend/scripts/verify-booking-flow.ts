// import fetch from 'node-fetch'; // Using global fetch

const API_URL = 'http://localhost:5000/api/bookings';

async function verifyBookingFlow() {
    try {
        // 1. Get Available Rooms
        const today = new Date();
        const checkIn = new Date(today);
        checkIn.setDate(today.getDate() + 30);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkIn.getDate() + 2);

        const checkInStr = checkIn.toISOString().split('T')[0];
        const checkOutStr = checkOut.toISOString().split('T')[0];

        console.log(`Checking availability for ${checkInStr} to ${checkOutStr}...`);
        const availResponse = await fetch(`${API_URL}/available?checkIn=${checkInStr}&checkOut=${checkOutStr}&adults=1&children=0`);

        if (!availResponse.ok) {
            throw new Error(`Failed to fetch availability: ${availResponse.statusText}`);
        }

        const availData = await availResponse.json();
        console.log('Availability response:', JSON.stringify(availData, null, 2));

        if (!availData.data || availData.data.length === 0) {
            console.log('No rooms available for these dates.');
            return;
        }

        // Pick the first available room
        const room = availData.data[0];
        // The API returns room objects. We need room_type_id.
        // Based on my fix, it should have room_type_id or type_id.
        // Let's check what we got.
        const roomTypeId = room.room_type_id || room.type?.id || room.type_id;

        if (!roomTypeId) {
            throw new Error('Could not find room_type_id in response');
        }

        console.log(`Selected Room Type ID: ${roomTypeId}`);

        // 2. Create Booking
        const bookingPayload = {
            firstName: 'John',
            lastName: 'Kipkemoi',
            email: 'jkipkemoi27@gmail.com',
            phone: '0712345678',
            checkInDate: checkInStr,
            checkOutDate: checkOutStr,
            roomTypeId: roomTypeId,
            adults: 2,
            children: 0,
            paymentMethod: 'mpesa',
            depositAmount: 0,
            bookingSource: 'WEBSITE'
        };

        console.log('Creating booking with payload:', bookingPayload);
        const bookingResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload)
        });

        const bookingData = await bookingResponse.json();
        console.log('Booking response:', JSON.stringify(bookingData, null, 2));

        if (bookingResponse.ok && bookingData.success) {
            console.log('✅ Booking created successfully!');
        } else {
            console.error('❌ Failed to create booking');
        }

    } catch (error) {
        console.error('Error verifying booking flow:', error);
    }
}

verifyBookingFlow();
