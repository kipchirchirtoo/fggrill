// Simple script to trigger user import via console in the Electron app
// Run this in the browser DevTools console (F12) when the app is open

(async function () {
    console.log('=== Starting User Import ===');

    try {
        const result = await window.electronAPI.cache.importUsers();

        if (result.success) {
            console.log('✅ Import Successful!');
            console.log(`   Imported: ${result.imported} users`);
            console.log(`   Errors: ${result.errors || 0}`);
            console.log(`   Total: ${result.total}`);
        } else {
            console.error('❌ Import Failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Import Error:', error.message);
    }
})();
