import * as dotenv from 'dotenv';
dotenv.config();
import { bookingService } from './src/services/booking.service';
import { RoomStatus } from './src/models/Room';
import { supabase } from './src/config/database';

async function verifyFix() {
    console.log('Starting verification of room status and availability logic...');

    try {
        // 1. Get Room 123 details
        const { data: room , error } = await supabase.from('rooms').select('id, room_number, status, room_type_id, branch_id').eq('room_number', '123').single();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        if (!room) throw new Error('Room 123 not found');

        console.log(`Initial Room 123 Status: ${room.status}`);

        // 2. Verify availability for a non-overlapping future date
        // Even if room is 'reserved' or 'occupied', it should be available for future dates
        console.log('\n--- Testing availability for future non-overlapping dates ---');
        const futureCheckIn = '2026-03-01';
        const futureCheckOut = '2026-03-05';

        const availability = await bookingService.checkAvailability(futureCheckIn, futureCheckOut, room.room_type_id, room.branch_id);
        const isRoom123Available = availability.availableRooms.some(r => r.id === room.id);

        if (isRoom123Available) {
            console.log('SUCCESS: Room 123 is available for future non-overlapping dates.');
        } else {
            console.error('FAILURE: Room 123 is NOT available for future non-overlapping dates.');
        }

        // 3. Verify room status update logic during booking
        console.log('\n--- Testing room status update logic during booking ---');

        // Test case A: Future booking (should NOT update status)
        console.log('Case A: Future booking (should NOT update status to reserved)');
        const futureBookingRequest = {
            guestInfo: { firstName: 'Future', lastName: 'Guest', email: `future.${Date.now()}@example.com`, phone: '000' },
            checkInDate: '2026-04-01',
            checkOutDate: '2026-04-05',
            roomTypeId: room.room_type_id,
            roomId: room.id,
            adults: 1,
            children: 0,
            paymentMethod: 'cash',
            bookingSource: 'RECEPTION',
            branchId: room.branch_id
        };

        // Set room to available first
        await bookingService.updateRoomStatus(room.id, RoomStatus.AVAILABLE);

        await bookingService.createBooking(futureBookingRequest as any);
        let { data: roomAfterFuture , error } = await supabase.from('rooms').select('status').eq('id', room.id).single();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        console.log(`Room status after future booking: ${roomAfterFuture?.status}`);
        if (roomAfterFuture?.status === RoomStatus.AVAILABLE) {
            console.log('SUCCESS: Room status remained AVAILABLE for future booking.');
        } else {
            console.error('FAILURE: Room status was incorrectly updated for future booking.');
        }

        // Test case B: Today's booking (SHOULD update status)
        console.log('\nCase B: Today\'s booking (SHOULD update status to reserved)');
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const todayBookingRequest = {
            guestInfo: { firstName: 'Today', lastName: 'Guest', email: `today.${Date.now()}@example.com`, phone: '111' },
            checkInDate: todayStr,
            checkOutDate: tomorrowStr,
            roomTypeId: room.room_type_id,
            roomId: room.id,
            adults: 1,
            children: 0,
            paymentMethod: 'cash',
            bookingSource: 'RECEPTION',
            branchId: room.branch_id
        };

        await bookingService.createBooking(todayBookingRequest as any);
        let { data: roomAfterToday , error } = await supabase.from('rooms').select('status').eq('id', room.id).single();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        console.log(`Room status after today's booking: ${roomAfterToday?.status}`);
        if (roomAfterToday?.status === RoomStatus.RESERVED) {
            console.log('SUCCESS: Room status updated to RESERVED for today\'s booking.');
        } else {
            console.error('FAILURE: Room status was NOT updated for today\'s booking.');
        }

        // 4. Cleanup
        console.log('\n--- Cleaning up test bookings ---');
        const { data: testGuests , error } = await supabase.from('guests').select('id').ilike('email', '%@example.com');
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        if (testGuests) {
            for (const g of testGuests) {
                const { data: res , error } = await supabase.from('reservations').select('id').eq('guest_id', g.id);
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
                if (res) {
                    for (const r of res) {
                        const { error } = await supabase.from('folios').delete().eq('reservation_id', r.id);
                        if (error) {
                          console.error('Database error:', error);
                          throw error;
                        }
                        const { error } = await supabase.from('reservations').delete().eq('id', r.id);
                        if (error) {
                          console.error('Database error:', error);
                          throw error;
                        }
                    }
                }
                const { error } = await supabase.from('guests').delete().eq('id', g.id);
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
            }
        }

        // 5. Restore Room 123 to reserved for the KIPCHIRCHIR reservation
        console.log('\n--- Restoring Room 123 status for active reservation ---');
        await bookingService.updateRoomStatus(room.id, RoomStatus.RESERVED, null, 'Restoring status for active reservation');
        console.log('Room 123 restored to RESERVED.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        process.exit();
    }
}

verifyFix();
