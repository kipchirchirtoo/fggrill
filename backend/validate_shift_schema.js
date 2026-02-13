const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkSchema() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected.');

        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cashier_shift_logs'
            ORDER BY ordinal_position;
        `;

        const res = await client.query(query);
        console.log('Columns in cashier_shift_logs:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

checkSchema();
