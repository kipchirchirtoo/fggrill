const fs = require('fs');
const { Client } = require('pg');

async function restoreBranches() {
    try {
        const backupStr = fs.readFileSync('db_backup.json', 'utf8');
        const backup = JSON.parse(backupStr);

        const branchesData = backup['branches'];
        if (!branchesData || branchesData.length === 0) {
            console.log("No branches found in backup!");
            return;
        }

        console.log(`Found ${branchesData.length} branches in backup.`);

        const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
        await client.connect();

        let restored = 0;
        const allowedColumns = ['name', 'code', 'location', 'is_main_branch', 'status', 'created_at', 'updated_at'];

        for (const b of branchesData) {
            // Because I've already migrated Kapsoit, Kyogong, Kaplong, I should ignore them using exact match or ILIKE on the base name
            const searchName = b.name.replace(' BRANCH', '').trim();
            const existsRes = await client.query("SELECT id FROM branches WHERE name ILIKE $1", [`%${searchName}%`]);
            
            if (existsRes.rows.length === 0) {
                console.log(`Restoring branch: ${b.name}`);
                
                const keys = [];
                const values = [];
                let paramIndex = 1;
                
                for (const col of allowedColumns) {
                    if (b[col] !== undefined) {
                        keys.push(col);
                        values.push(b[col]);
                    }
                }
                
                const params = keys.map((_, i) => '$' + (i + 1));
                const query = `INSERT INTO branches (${keys.join(', ')}) VALUES (${params.join(', ')})`;
                
                try {
                    await client.query(query, values);
                    restored++;
                } catch (innerErr) {
                    console.error(`Failed to restore ${b.name}: ${innerErr.message}`);
                }
            } else {
                console.log(`Branch already exists matching: ${searchName}`);
            }
        }

        console.log(`Successfully restored ${restored} branches from backup.`);
        await client.end();
    } catch (e) {
        console.error("Error restoring branches:", e);
    }
}

restoreBranches();
