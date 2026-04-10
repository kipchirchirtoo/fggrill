const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillInvoiceNumbers() {
    console.log('🔧 Backfilling missing invoice numbers...\n');

    try {
        // Find bookings without invoice_number
        const { data: bookings, error } = await supabase
            .from('conference_hall_bookings')
            .select('id, created_at, customer_name')
            .is('invoice_number', null);

        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }

        if (!bookings || bookings.length === 0) {
            console.log('✅ All bookings already have invoice numbers!');
            return;
        }

        console.log(`📋 Found ${bookings.length} bookings without invoice numbers\n`);

        for (const booking of bookings) {
            // Generate invoice number: CNF-YYYYMMDD-XXXX
            const date = new Date(booking.created_at);
            const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
            const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
            const invoiceNumber = `CNF-${dateStr}-${randomStr}`;

            // Update the booking
            const { error: updateError } = await supabase
                .from('conference_hall_bookings')
                .update({ invoice_number: invoiceNumber })
                .eq('id', booking.id);

            if (updateError) {
                console.log(`❌ Failed to update ${booking.id}:`, updateError.message);
            } else {
                console.log(`✅ ${booking.customer_name}: ${invoiceNumber}`);
            }
        }

        console.log('\n🎉 Backfill complete!');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

backfillInvoiceNumbers();
