
import { pool } from './src/config/pg';

async function checkUserRole() {
    try {
        const res = await pool.query("SELECT email, role FROM users WHERE email = 'allansamuel571@gmail.com'");
        console.log('User Role:', res.rows[0]);
    } catch (err) {
        console.error('Error checking user role:', err);
    } finally {
        await pool.end();
    }
}

checkUserRole();
