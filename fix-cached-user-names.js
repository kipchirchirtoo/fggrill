/**
 * Fix Cached User Names in SQLite Database
 * This script updates cached_pins to ensure first_name and last_name are properly stored
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'famous-gate-pos', 'pos-offline.db');

console.log('🔧 Fixing Cached User Names...\n');
console.log('📂 Database:', DB_PATH);

try {
    const db = new Database(DB_PATH);
    
    // Get all cached users
    const users = db.prepare('SELECT * FROM cached_pins').all();
    console.log(`\n📋 Found ${users.length} cached users\n`);
    
    if (users.length === 0) {
        console.log('ℹ️  No users to fix');
        db.close();
        process.exit(0);
    }
    
    // Update each user
    const updateStmt = db.prepare('UPDATE cached_pins SET user_data = ? WHERE id = ?');
    
    let fixed = 0;
    for (const user of users) {
        try {
            const userData = JSON.parse(user.user_data);
            console.log(`\n👤 User: ${userData.email || userData.username || 'Unknown'}`);
            console.log(`   Current data:`, {
                first_name: userData.first_name,
                last_name: userData.last_name,
                firstName: userData.firstName,
                lastName: userData.lastName
            });
            
            // Normalize names
            const hasSnakeCase = userData.first_name || userData.last_name;
            const hasCamelCase = userData.firstName || userData.lastName;
            
            if (!hasSnakeCase && !hasCamelCase) {
                console.log('   ⚠️  No name fields found - skipping');
                continue;
            }
            
            // Ensure both formats exist
            userData.first_name = userData.first_name || userData.firstName || '';
            userData.last_name = userData.last_name || userData.lastName || '';
            userData.firstName = userData.firstName || userData.first_name || '';
            userData.lastName = userData.lastName || userData.last_name || '';
            
            console.log(`   ✅ Fixed:`, {
                first_name: userData.first_name,
                last_name: userData.last_name,
                firstName: userData.firstName,
                lastName: userData.lastName
            });
            
            // Update database
            updateStmt.run(JSON.stringify(userData), user.id);
            fixed++;
            
        } catch (e) {
            console.error(`   ❌ Error processing user ${user.id}:`, e.message);
        }
    }
    
    console.log(`\n✅ Fixed ${fixed} users`);
    
    // Verify
    console.log('\n📊 Verification:');
    const verifyUsers = db.prepare('SELECT * FROM cached_pins').all();
    verifyUsers.forEach(u => {
        const data = JSON.parse(u.user_data);
        console.log(`   - ${data.email || data.username}: firstName="${data.firstName}", lastName="${data.lastName}"`);
    });
    
    db.close();
    console.log('\n✅ Complete!');
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
}
