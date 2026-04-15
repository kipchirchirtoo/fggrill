import * as dotenv from 'dotenv';
dotenv.config();
import { bookingService } from './src/services/booking.service';
import { RoomStatus } from './src/models/Room';
import db from './src/db';
import { supabase } from './src/config/database';

async function verifyRoomStatusImplementation() {
    console.log('Starting room status implementation verification...');

    try {
        // 1. Get a test room
        const { data: rooms } = await supabase
            .from('rooms')
            .select('id, room_number, status')
            .limit(1);

        if (!rooms || rooms.length === 0) {
            throw new Error('No rooms found for testing');
        }

        const testRoom = rooms[0];
        const roomId = testRoom.id;
        console.log(`Testing with room: ${testRoom.room_number} (${roomId})`);

        // 2. Test transition: Available -> Reserved
        console.log('\n--- Testing transition: Available -> Reserved ---');
        await bookingService.updateRoomStatus(roomId, RoomStatus.RESERVED, null, 'Test: Available -> Reserved');

        let { data: room , error } = await supabase.from('rooms').select('status').eq('id', roomId).single();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        console.log(`Current status: ${room?.status}`);
        if (room?.status !== RoomStatus.RESERVED) throw new Error('Failed to update status to Reserved');

        // 3. Test transition: Reserved -> Occupied
        console.log('\n--- Testing transition: Reserved -> Occupied ---');
        await bookingService.updateRoomStatus(roomId, RoomStatus.OCCUPIED, null, 'Test: Reserved -> Occupied');

        ({ data: room } = await supabase.from('rooms').select('status').eq('id', roomId).single());
        console.log(`Current status: ${room?.status}`);
        if (room?.status !== RoomStatus.OCCUPIED) throw new Error('Failed to update status to Occupied');

        // 4. Test transition: Occupied -> Cleaning
        console.log('\n--- Testing transition: Occupied -> Cleaning ---');
        await bookingService.updateRoomStatus(roomId, RoomStatus.CLEANING, null, 'Test: Occupied -> Cleaning');

        ({ data: room } = await supabase.from('rooms').select('status').eq('id', roomId).single());
        console.log(`Current status: ${room?.status}`);
        if (room?.status !== RoomStatus.CLEANING) throw new Error('Failed to update status to Cleaning');

        // 5. Test transition: Cleaning -> Available
        console.log('\n--- Testing transition: Cleaning -> Available ---');
        await bookingService.updateRoomStatus(roomId, RoomStatus.AVAILABLE, null, 'Test: Cleaning -> Available');

        ({ data: room } = await supabase.from('rooms').select('status').eq('id', roomId).single());
        console.log(`Current status: ${room?.status}`);
        if (room?.status !== RoomStatus.AVAILABLE) throw new Error('Failed to update status to Available');

        // 6. Verify history logging
        console.log('\n--- Verifying history logging ---');
        const historyResult = await db.query(`
      SELECT * FROM room_status_history 
      WHERE room_id = $1 
      ORDER BY created_at DESC 
      LIMIT 4
    `, [roomId]);

        console.log(`Found ${historyResult.rows.length} history entries`);
        historyResult.rows.forEach(row => {
            console.log(`- ${row.previous_status} -> ${row.new_status}: ${row.notes}`);
        });

        if (historyResult.rows.length < 4) {
            throw new Error('Missing history entries');
        }

        console.log('\nSUCCESS: Room status implementation verified');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        process.exit();
    }
}

verifyRoomStatusImplementation();
