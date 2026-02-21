// Test script to check if menu items are in the cache
// Run this in the browser console: copy and paste this code

(async () => {
    console.log('=== MENU CACHE TEST ===');
    
    // Check if electronAPI is available
    if (!window.electronAPI) {
        console.error('❌ electronAPI not available - not running in Electron');
        return;
    }
    
    console.log('✓ electronAPI is available');
    
    // Check categories
    try {
        const categories = await window.electronAPI.db.get('restaurant_menu_categories', {});
        console.log(`✓ Categories in cache: ${categories?.length || 0}`);
        if (categories && categories.length > 0) {
            console.log('Sample category:', categories[0]);
        }
    } catch (e) {
        console.error('❌ Error fetching categories:', e);
    }
    
    // Check menu items
    try {
        const items = await window.electronAPI.db.get('restaurant_menu_items', {});
        console.log(`✓ Menu items in cache: ${items?.length || 0}`);
        if (items && items.length > 0) {
            console.log('Sample item:', items[0]);
            console.log('Items with null branch_id:', items.filter(i => i.branch_id === null).length);
            console.log('Items with specific branch_id:', items.filter(i => i.branch_id !== null).length);
        }
    } catch (e) {
        console.error('❌ Error fetching menu items:', e);
    }
    
    console.log('=== TEST COMPLETE ===');
})();
