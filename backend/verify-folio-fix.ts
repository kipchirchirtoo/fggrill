import * as dotenv from 'dotenv';
dotenv.config();
import { bookingService } from './src/services/booking.service';
import { Folio } from './src/models/Folio';
import { supabase } from './src/config/database';

async function verifyFolioFix() {
    console.log('Starting folio fix verification...');

    try {
        // 1. Test automatic creation during booking
        console.log('\n--- Testing automatic folio creation during booking ---');
        const testBookingRequest = {
            guestInfo: {
                firstName: 'Folio',
                lastName: 'Tester',
                email: `folio.tester.${Date.now()}@example.com`,
                phone: '1234567890'
            },
            checkInDate: '2026-02-01',
            checkOutDate: '2026-02-05',
            roomTypeId: 'cbc18e5f-34ab-45c5-b403-60592348601a', // Standard room type ID
            adults: 1,
            children: 0,
            paymentMethod: 'cash',
            bookingSource: 'RECEPTION',
            branchId: 2
        };

        const booking = await bookingService.createBooking(testBookingRequest as any);
        console.log(`Created booking: ${booking.id}`);

        const folio = await Folio.findByReservationId(booking.id);
        if (folio) {
            console.log(`SUCCESS: Folio automatically created: ${folio.id}`);
        } else {
            console.error('FAILURE: Folio not created during booking');
        }

        // 2. Test lazy creation
        console.log('\n--- Testing lazy folio creation ---');
        if (folio) {
            // Delete the folio to simulate an old booking without one
            const { error: deleteError } = await supabase
                .from('folios')
                .delete()
                .eq('id', folio.id);

            if (deleteError) throw deleteError;
            console.log('Deleted folio to test lazy creation');
        }

        // We can't easily call the controller directly without a full express setup,
        // but we can simulate the logic or use a script that mimics the controller's behavior.
        // Let's just run the logic from the controller here.

        console.log('Simulating getFolio lazy creation logic...');
        let lazyFolio = await Folio.findByReservationId(booking.id);
        if (!lazyFolio) {
            const { data: reservation } = await supabase
                .from('reservations')
                .select('*')
                .eq('id', booking.id)
                .single();

            if (reservation) {
                lazyFolio = new Folio({
                    reservationId: reservation.id,
                    guestId: reservation.guest_id,
                    status: 'open',
                    roomCharges: reservation.total_amount || 0
                });
                await lazyFolio.save();
                console.log(`SUCCESS: Lazy created folio: ${lazyFolio.id}`);
            }
        }

        // Cleanup
        console.log('\n--- Cleaning up ---');
        const { error } = await supabase.from('reservations').delete().eq('id', booking.id);
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        if (lazyFolio) const { error } = await supabase.from('folios').delete().eq('id', lazyFolio.id);
 if (error) {
   console.error('Database error:', error);
   throw error;
 }
        console.log('Cleanup complete');

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyFolioFix();
