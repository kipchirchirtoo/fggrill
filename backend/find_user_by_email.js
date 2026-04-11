const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    const email = 'jkipkemoi27@gmail.com';
    
    // Check if user exists
    const user = await client.query(`
        SELECT id, email, first_name, last_name, role, branch_id 
        FROM users 
        WHERE email = $1
    `, [email]);
    
    console.log(`\nSearching for user with email: ${email}`);
    console.table(user.rows);
    
    if (user.rows.length > 0) {
        const userId = user.rows[0].id;
        
        // Check staff profile
        const staff = await client.query(`
            SELECT id, user_id, first_name, last_name, id_number, national_id 
            FROM staff_profiles 
            WHERE user_id = $1 OR email = $2
        `, [userId, email]);
        
        console.log('\nLinked staff profiles:');
        console.table(staff.rows);
    }
    
    await client.end();
}
check();
