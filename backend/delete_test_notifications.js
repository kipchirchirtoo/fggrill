const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    'https://utsvlihpudfraxzcmtle.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
