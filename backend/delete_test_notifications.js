const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    'https://utsvlihpudfraxzcmtle.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function deleteTestNotifications() {
    try {
        console.log('Deleting test notifications...');

        // Delete all test notifications
        const { data, error } = await supabase
            .from('notifications')
            .delete()
            .or('title.eq.Test Notification,title.eq.Kyogongs Connected!')
            .select();

        if (error) {
            console.error('Error deleting notifications:', error);
            return;
        }

        console.log(`✅ Successfully deleted ${data.length} test notifications`);

        // Get remaining count
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true });

        console.log(`📊 Remaining notifications: ${count}`);

    } catch (error) {
        console.error('Exception:', error);
    }
}

deleteTestNotifications();
