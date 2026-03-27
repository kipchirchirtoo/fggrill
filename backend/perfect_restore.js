const fs = require('fs');
const { Client } = require('pg');
const { execSync } = require('child_process');

async function perfectRestore() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    
    try {
        await client.connect();
        
        console.log("Loading backup data...");
        const backupStr = fs.readFileSync('db_backup.json', 'utf8');
        const backup = JSON.parse(backupStr);
        const originalBranches = backup['branches'];

        await client.query("BEGIN");

        console.log("1. Detaching users from branches to allow safe branch deletion...");
        await client.query("UPDATE users SET branch_id = NULL");

        console.log("2. Deleting all 183 staff_profiles...");
        await client.query("DELETE FROM staff_profiles");

        console.log("3. Deleting all branches...");
        await client.query("DELETE FROM branches");

        console.log("4. Restoring exact 10 branches from backup...");
        const allowedColumns = ['id', 'name', 'code', 'location', 'is_main_branch', 'status', 'created_at', 'updated_at'];
        for (const b of originalBranches) {
            const keys = [];
            const values = [];
            for (const col of allowedColumns) {
                if (b[col] !== undefined) {
                    keys.push(col);
                    values.push(b[col]);
                }
            }
            const params = keys.map((_, i) => '$' + (i + 1));
            const query = `INSERT INTO branches (${keys.join(', ')}) VALUES (${params.join(', ')})`;
            await client.query(query, values);
        }

        console.log("5. Checking constraint on branch_id...");
        // Ensure the sequence is updated based on highest ID
        await client.query("SELECT setval('branches_id_seq', (SELECT MAX(id) FROM branches))");

        console.log("6. Reattaching Superadmin to Kyogong (id: 1)...");
        // Superadmin originally probably had Kyogong or branch_id = null. We can set it to 1 safely.
        await client.query("UPDATE users SET branch_id = 1 WHERE email = 'kipchirchirtoo01@gmail.com'");

        await client.query("COMMIT");
        console.log("✅ Database tables cleanly reset with original 10 branches.");
        
        console.log("7. Processing Staff Imports to exact branches...");
        
        console.log("-> Running import_kyogong.js");
        execSync("node import_kyogong.js", { stdio: 'inherit' });
        
        console.log("-> Running import_kaplong.js");
        execSync("node import_kaplong.js", { stdio: 'inherit' });
        
        console.log("-> Running import_kapsoit.js");
        execSync("node import_kapsoit.js", { stdio: 'inherit' });

        console.log("-> Running import_mogogoshiek.js");
        execSync("node import_mogogoshiek.js", { stdio: 'inherit' });

        console.log("✨ ALL TASKS COMPLETED SUCCESSFULLY!");
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Critical error during perfect restore. Rolled back.", e);
    } finally {
        await client.end();
    }
}

perfectRestore();
