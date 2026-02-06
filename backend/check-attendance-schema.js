
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkAttendanceColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'staff_attendance'
            ORDER BY ordinal_position;
        `);
        console.log('Columns in staff_attendance:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        const countRes = await pool.query('SELECT COUNT(*) FROM staff_attendance');
        console.log(`Total rows in staff_attendance: ${countRes.rows[0].count}`);

        const lastRes = await pool.query('SELECT * FROM staff_attendance ORDER BY created_at DESC LIMIT 5');
        console.log('Last 5 attendance records:');
        console.log(JSON.stringify(lastRes.rows, null, 2));

    } catch (err) {
        console.error('Error checking columns:', err.message);
    } finally {
        await pool.end();
    }
}

checkAttendanceColumns();
