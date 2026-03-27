const { Client } = require('pg');

async function checkTotalStaff() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    
    try {
        await client.connect();
        
        // Total staff
        const overallRes = await client.query('SELECT COUNT(*) FROM staff_profiles');
        console.log(`TOTAL STAFF GLOBALLY: ${overallRes.rows[0].count}`);
        
        console.log('\n--- BREAKDOWN BY BRANCH ---');
        // By branch
        const branchRes = await client.query(`
            SELECT b.name as branch_name, COUNT(s.id) as staff_count
            FROM branches b
            LEFT JOIN staff_profiles s ON s.branch_id = b.id
            GROUP BY b.id, b.name
            HAVING COUNT(s.id) > 0
            ORDER BY staff_count DESC;
        `);
        
        branchRes.rows.forEach(row => {
            console.log(`${row.branch_name}: ${row.staff_count} employees`);
        });

    } catch (e) {
        console.error('Error fetching count:', e);
    } finally {
        await client.end();
    }
}

checkTotalStaff();
