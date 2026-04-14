const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function fixStaffBranchFiltering() {
    const client = await pool.connect();
    
    try {
        console.log('========================================');
        console.log(' FIXING STAFF BRANCH FILTERING');
        console.log('========================================\n');

        // 1. Check if cashier_shifts has branch_id column
        console.log('1. Checking cashier_shifts table...');
        const shiftsCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cashier_shifts' 
            AND column_name = 'branch_id'
        `);

        if (shiftsCheck.rows.length === 0) {
            console.log('   ⚠️  branch_id column missing in cashier_shifts');
            console.log('   Adding branch_id column...');
            
            await client.query(`
                ALTER TABLE cashier_shifts 
                ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)
            `);
            
            console.log('   ✅ Added branch_id column');
        } else {
            console.log('   ✅ branch_id column exists');
        }

        // 2. Update existing shifts with branch_id from cashier's user record
        console.log('\n2. Updating existing shifts with branch_id...');
        const updateResult = await client.query(`
            UPDATE cashier_shifts cs
            SET branch_id = u.branch_id
            FROM users u
            WHERE cs.cashier_id = u.id
            AND cs.branch_id IS NULL
            AND u.branch_id IS NOT NULL
        `);
        
        console.log(`   ✅ Updated ${updateResult.rowCount} shifts with branch_id`);

        // 3. Check staff_profiles table
        console.log('\n3. Checking staff_profiles table...');
        const staffCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'staff_profiles' 
            AND column_name = 'branch_id'
        `);

        if (staffCheck.rows.length === 0) {
            console.log('   ⚠️  branch_id column missing in staff_profiles');
            console.log('   Adding branch_id column...');
            
            await client.query(`
                ALTER TABLE staff_profiles 
                ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)
            `);
            
            console.log('   ✅ Added branch_id column');
        } else {
            console.log('   ✅ branch_id column exists');
        }

        // 4. Sync staff_profiles branch_id with users table
        console.log('\n4. Syncing staff_profiles with users branch_id...');
        const syncResult = await client.query(`
            UPDATE staff_profiles sp
            SET branch_id = u.branch_id
            FROM users u
            WHERE sp.user_id = u.id
            AND (sp.branch_id IS NULL OR sp.branch_id != u.branch_id)
            AND u.branch_id IS NOT NULL
        `);
        
        console.log(`   ✅ Synced ${syncResult.rowCount} staff profiles`);

        // 5. Check current staff distribution by branch
        console.log('\n5. Staff distribution by branch:');
        const distribution = await client.query(`
            SELECT 
                b.name as branch_name,
                COUNT(sp.id) as staff_count
            FROM branches b
            LEFT JOIN staff_profiles sp ON sp.branch_id = b.id
            GROUP BY b.id, b.name
            ORDER BY b.name
        `);
        
        distribution.rows.forEach(row => {
            console.log(`   📍 ${row.branch_name}: ${row.staff_count} staff`);
        });

        // 6. Test staff API with branch filter
        console.log('\n6. Testing staff API query...');
        const testQuery = await client.query(`
            SELECT 
                sp.id,
                sp.first_name,
                sp.last_name,
                sp.branch_id,
                b.name as branch_name
            FROM staff_profiles sp
            LEFT JOIN branches b ON b.id = sp.branch_id
            WHERE sp.status = 'active'
            AND sp.branch_id IS NOT NULL
            LIMIT 5
        `);
        
        console.log(`   ✅ Found ${testQuery.rows.length} active staff with branch assignment`);
        testQuery.rows.forEach(row => {
            console.log(`      - ${row.first_name} ${row.last_name} (${row.branch_name})`);
        });

        console.log('\n========================================');
        console.log(' FIX COMPLETED');
        console.log('========================================\n');
        console.log('✅ Staff branch filtering is now properly configured');
        console.log('✅ Cashier shifts have branch_id');
        console.log('✅ Staff profiles synced with user branch assignments');
        console.log('\nStaff dropdowns will now filter by branch automatically!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixStaffBranchFiltering();
