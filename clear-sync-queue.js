/**
 * Clear Sync Queue - Developer Console Script
 * 
 * This script clears all pending sync queue items from the Electron app.
 * 
 * HOW TO USE:
 * 1. Open the Electron app
 * 2. Press Ctrl+Shift+I (or Cmd+Option+I on Mac) to open Developer Console
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter
 * 
 * The script will:
 * - Clear all pending, failed, and stuck sync items
 * - Show you the results
 * - Reload the app to refresh the UI
 */

(async function clearSyncQueue() {
    console.log('🧹 Clearing sync queue...');
    
    try {
        // Check current status first
        const beforeStatus = await window.electronAPI.invoke('sync:status');
        console.log('📊 Before clearing:', beforeStatus);
        
        // Clear the queue
        const result = await window.electronAPI.invoke('sync:clear');
        
        if (result.success) {
            console.log('✅ Sync queue cleared successfully!');
            console.log('📊 Remaining items:', result.remaining);
            
            // Check status after clearing
            const afterStatus = await window.electronAPI.invoke('sync:status');
            console.log('📊 After clearing:', afterStatus);
            
            // Reload the app to refresh UI
            console.log('🔄 Reloading app in 2 seconds...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            console.error('❌ Failed to clear sync queue:', result.error);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
