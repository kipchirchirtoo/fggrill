const { Pool } = require('pg');

const dbUrl = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const MANAGEMENT_ROLES = [
    'super_admin',
    'branch_manager',
    'general_manager',
    'ceo',
    'admin',
    // Fallbacks
    'manager',
    'management'
];

async function fixStaffIds() {
    const client = await pool.connect();
    try {
        console.log('🚀 Connecting to database to fix Staff IDs...');

        await client.query('BEGIN');

        // 1. Get all branches map (id -> code)
        const branchRes = await client.query('SELECT id, code FROM branches');
        const branchMap = {};
        branchRes.rows.forEach(b => {
            branchMap[b.id] = b.code || 'FG';
        });

        // 2. Get all staff profiles ordered by creation time
        // Join with users to get role
        const staffRes = await client.query(`
            SELECT sp.id, sp.branch_id, sp.id_number, sp.created_at, u.role, sp.user_id
            FROM staff_profiles sp
            JOIN users u ON sp.user_id = u.id
            ORDER BY sp.created_at ASC
        `);

        console.log(`Found ${staffRes.rows.length} staff members.`);

        // Group by branch to handle sequencing per branch
        const staffByBranch = {};

        staffRes.rows.forEach(staff => {
            const branchId = staff.branch_id || 'DEFAULT';
            if (!staffByBranch[branchId]) {
                staffByBranch[branchId] = {
                    management: [],
                    others: []
                };
            }

            const role = (staff.role || '').toLowerCase();
            const isManagement = MANAGEMENT_ROLES.some(r => role.includes(r));

            if (isManagement) {
                staffByBranch[branchId].management.push(staff);
            } else {
                staffByBranch[branchId].others.push(staff);
            }
        });

        // 3. Generate correct IDs and Update
        let updatesCount = 0;

        for (const branchId of Object.keys(staffByBranch)) {
            const group = staffByBranch[branchId];

            // Determine branch code based on numeric ID (e.g. 1 -> 01)
            // If branchId is 'DEFAULT' (null), use '00'?
            let numericBranchCode = '00';
            if (branchId !== 'DEFAULT') {
                numericBranchCode = String(branchId).padStart(2, '0');
            }

            let prefix = `FG${numericBranchCode}`;

            console.log(`Processing Branch ${branchId} -> Prefix: ${prefix}`);

            // Update Management (001-010)
            // Note: If more than 10 managers, we wrap or exceed? user said "001 TO 010 ARE RESERVED".
            // Implementation: (i % 10) + 1 maybe?

            group.management.forEach((staff, index) => {
                const seq = (index % 10) + 1;
                const newId = `${prefix}${String(seq).padStart(3, '0')}`;

                if (staff.id_number !== newId) {
                    // Update
                    client.query('UPDATE staff_profiles SET id_number = $1 WHERE id = $2', [newId, staff.id]);
                    console.log(`Updated Staff ${staff.first_name || staff.id}: ${staff.id_number} -> ${newId}`);
                    updatesCount++;
                }
            });

            // Update Others (011+)
            group.others.forEach((staff, index) => {
                const seq = index + 11;
                const newId = `${prefix}${String(seq).padStart(3, '0')}`;

                if (staff.id_number !== newId) {
                    client.query('UPDATE staff_profiles SET id_number = $1 WHERE id = $2', [newId, staff.id]);
                    console.log(`Updated Staff ${staff.id}: ${staff.id_number} -> ${newId}`);
                    updatesCount++;
                }
            });
        }

        await client.query('COMMIT');
        console.log(`✅ Successfully updated ${updatesCount} staff IDs.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to fix staff IDs:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixStaffIds();
