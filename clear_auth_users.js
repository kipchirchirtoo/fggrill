/**
 * Clear all users from auth.users EXCEPT the superadmin
 */
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function clearAuthUsers() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    const superadminEmail = 'kipchirchirtoo01@gmail.com';

    try {
        await client.connect();
        console.log('Connecting to database...');

        // Verify superadmin exists first
        const { rows } = await client.query('SELECT id FROM auth.users WHERE email = $1', [superadminEmail]);

        if (rows.length === 0) {
            console.error(`❌ Error: Superadmin ${superadminEmail} not found in auth.users. Aborting to prevent lockout.`);
            return;
        }

        const superadminId = rows[0].id;
        console.log(`Found superadmin: ${superadminEmail} (${superadminId})`);

        // Delete other users
        // Note: CASCADE should handle public.users, but we already cleaned that mostly.
        // However, it's safer to delete by ID and exclude the superadmin.
        console.log('Cleaning up auth.users...');
        const deleteRes = await client.query('DELETE FROM auth.users WHERE id != $1', [superadminId]);

        console.log(`✅ Successfully removed ${deleteRes.rowCount} users from auth.users.`);
        console.log(`Preserved superadmin: ${superadminEmail}`);

    } catch (err) {
        console.error('❌ Error clearing auth users:', err.message);
    } finally {
        await client.end();
    }
}

clearAuthUsers();
