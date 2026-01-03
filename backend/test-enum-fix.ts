import * as dotenv from 'dotenv';
dotenv.config();
import { bookingService } from './src/services/booking.service';

async function testAvailability() {
    console.log('Testing checkAvailability with "reserved" status...');

    try {
        const checkIn = '2026-01-01';
        const checkOut = '2026-01-08';

        // This should not throw an error now
        const result = await bookingService.checkAvailability(checkIn, checkOut, '');
        const availableRooms = result.availableRooms;
        console.log('Successfully checked availability. Found rooms:', availableRooms.length);

        // Try to update a room to 'reserved'
        if (availableRooms.length > 0) {
            const roomId = availableRooms[0].id;
            console.log(`Testing updateRoomStatus to "reserved" for room ${roomId}...`);
            await (bookingService as any).updateRoomStatus(roomId, 'reserved');
            console.log('Successfully updated room status to "reserved".');

            // Reset it back to 'available'
            await (bookingService as any).updateRoomStatus(roomId, 'available');
            console.log('Successfully reset room status to "available".');
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAvailability();
