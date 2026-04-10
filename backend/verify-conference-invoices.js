const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function verify() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Check if invoice_number column exists
        const columnCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conference_hall_bookings' 
            AND column_name = 'invoice_number'
        `);
        
        console.log('\n✓ Column check:', columnCheck.rows.length > 0 ? 'invoice_number column EXISTS' : 'invoice_number column MISSING');

        // Check existing bookings
        const bookings = await client.query(`
            SELECT id, invoice_number, customer_name, 
                   SUBSTRING(notes, 1, 100) as notes_preview
            FROM conference_hall_bookings 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        console.log(`\n✓ Found ${bookings.rows.length} conference bookings`);
        
        if (bookings.rows.length > 0) {
            console.log('\nSample bookings:');
            bookings.rows.forEach((b, i) => {
                console.log(`  ${i + 1}. ${b.customer_name}`);
                console.log(`     Invoice: ${b.invoice_number || 'NULL (needs backfill)'}`);
                console.log(`     Notes preview: ${b.notes_preview || 'empty'}`);
                console.log('');
            });

            // Count bookings without invoice_number
            const nullCount = await client.query(`
                SELECT COUNT(*) as count 
                FROM conference_hall_bookings 
                WHERE invoice_number IS NULL
            `);
            
            console.log(`\n⚠ Bookings without invoice_number: ${nullCount.rows[0].count}`);
            
            if (parseInt(nullCount.rows[0].count) > 0) {
                console.log('\n🔧 Running backfill for existing bookings...');
                
                const backfill = await client.query(`
                    UPDATE conference_hall_bookings
                    SET invoice_number = (
                        SELECT (regexp_match(notes, '"invoice_number":"([^"]+)"'))[1]
                    )
                    WHERE invoice_number IS NULL 
                      AND notes LIKE '%__METADATA__%'
                      AND notes LIKE '%invoice_number%'
                    RETURNING id, invoice_number, customer_name
                `);
                
                console.log(`✓ Backfilled ${backfill.rows.length} bookings`);
                if (backfill.rows.length > 0) {
                    backfill.rows.forEach(b => {
                        console.log(`  - ${b.customer_name}: ${b.invoice_number}`);
                    });
                }
            }
        }

        console.log('\n✅ Verification complete');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

verify();
