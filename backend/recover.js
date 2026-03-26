const fs = require('fs');
const { Client } = require('pg');

async function recover() {
    const backup = JSON.parse(fs.readFileSync('db_backup.json', 'utf8'));
    
    // Find the superadmin user
    const users = backup['users'] || [];
    const superadmin = users.find(u => u.email === 'kipchirchirtoo01@gmail.com');
    // Also, if the user has role_id, department_id, branch_id, etc. we might need to restore those records.
    
    console.log('Superadmin record in backup:', superadmin);

    if (!superadmin) {
        console.error('Superadmin not found in backup!');
        process.exit(1);
    }
    
    // We should figure out what tables we must restore to satisfy foreign keys for this user.
    // For simplicity, let's restore the row into tables that this user references directly.
    // For example: if user has role_id, restore that role.
    const toRestore = {};
    if (superadmin.role_id && backup['roles']) {
        toRestore['roles'] = backup['roles'].find(r => r.id === superadmin.role_id);
    }
    if (superadmin.branch_id && backup['branches']) {
        toRestore['branches'] = backup['branches'].find(b => b.id === superadmin.branch_id);
    }
    if (superadmin.department_id && backup['departments']) {
         toRestore['departments'] = backup['departments'].find(d => d.id === superadmin.department_id);
    }

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Disable triggers to avoid issues, or just strictly insert
        await client.query('SET session_replication_role = replica');

        // Insert references
        for (const [table, record] of Object.entries(toRestore)) {
            if (record) {
                const cols = Object.keys(record);
                const values = Object.values(record);
                const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
                const query = `INSERT INTO "${table}" ("${cols.join('", "')}") VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
                await client.query(query, values);
                console.log(`Restored reference in ${table}`);
            }
        }

        // Insert user
        const cols = Object.keys(superadmin);
        const values = Object.values(superadmin);
        const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
        const query = `INSERT INTO users ("${cols.join('", "')}") VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await client.query(query, values);
        console.log('Restored superadmin user');

        await client.query('SET session_replication_role = DEFAULT');
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(e);
    }
    await client.end();
}
recover().catch(console.error);
