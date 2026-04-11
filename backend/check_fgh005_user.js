const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    // Check the staff member with FGH005
    const staff = await client.query(`
        SELECT id, user_id, first_name, last_name, id_number, national_id, email, phone 
        FROM staff_profiles 
        WHERE id_number = 'FGH005'
    `);
    
    console.log('\nStaff profile for FGH005:');
    console.table(staff.rows);
    
    if (staff.rows.length > 0 && staff.rows[0].user_id) {
        const userId = staff.rows[0].user_id;
        const user = await client.query(`
            SELECT id, email, first_name, last_name, role 
            FROM users 
            WHERE id = $1
        `, [userId]);
        
        console.log('\nLinked user account:');
        console.table(user.rows);
    } else {
        console.log('\n⚠️  No user_id linked to this staff profile!');
    }
    
    await client.end();
}
check();
