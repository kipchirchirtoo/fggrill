
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend .env
const envPath = path.join(process.cwd(), 'backend', '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    console.error('Loaded env vars:', process.env.SUPABASE_PROJECT_URL ? 'URL found' : 'URL missing', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Key found' : 'Key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteAllGuests() {
    console.log('Starting deletion of all guests...');

    try {
        // First check if there are any guests
        const { count, error: countError } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        if (count === 0) {
            console.log('No guests found to delete.');
            return;
        }

        console.log(`Found ${count} guests. Proceeding to delete...`);

        // Delete all guests
        const { error } = await supabase
            .from('guests')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

        if (error) {
            console.error('Error deleting guests:', error);

            // If error is foreign key violation, we might need to delete bookings first
            if (error.code === '23503') { // Foreign key violation code
                console.log('Foreign key violation detected. Attempting to delete related bookings first...');
                const { error: bookingError } = await supabase
                    .from('bookings')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (bookingError) {
                    console.error('Error deleting bookings:', bookingError);
                    return;
                }
                console.log('All bookings deleted. Retrying guest deletion...');

                const { error: retryError } = await supabase
                    .from('guests')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (retryError) {
                    console.error('Retry failed:', retryError);
                    return;
                }
            } else {
                return;
            }
        }

        console.log('All guests (and potentially bookings) have been successfully deleted.');

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

deleteAllGuests();
