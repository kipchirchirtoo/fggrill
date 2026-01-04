import { barAPI } from './frontend/src/lib/api';

async function verifyTabs() {
    console.log('Starting verification...');

    try {
        // 1. Get open tabs
        const tabsRes = await barAPI.getTabs(undefined, 'open');
        console.log('Get Tabs Response:', tabsRes.success ? 'Success' : 'Failed');

        if (tabsRes.success && tabsRes.data && tabsRes.data.length > 0) {
            const tab = tabsRes.data[0];
            console.log(`Found open tab: ${tab.tab_number} (${tab.id})`);

            // 2. Add item to tab
            const items = [
                {
                    drink_id: 'test-drink-id',
                    name: 'Test Drink',
                    price: 500,
                    quantity: 2
                }
            ];

            console.log(`Adding items to tab ${tab.id}...`);
            const addRes = await barAPI.addToTab(tab.id, items);
            console.log('Add to Tab Response:', addRes.success ? 'Success' : 'Failed');
            if (!addRes.success) {
                console.error('Error adding to tab:', addRes.message);
            }
        } else {
            console.log('No open tabs found to test with.');
        }
    } catch (error) {
        console.error('Verification failed:', error);
    }
}

// verifyTabs();
