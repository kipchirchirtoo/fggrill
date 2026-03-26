const fs = require('fs');

function inspect() {
    const backupStr = fs.readFileSync('db_backup.json', 'utf8');
    const backup = JSON.parse(backupStr);

    const branchesData = backup['branches'];
    if (!branchesData) {
        console.log("No branches found in backup!");
        return;
    }

    console.log("Original Branches from backup:");
    for (const b of branchesData) {
        console.log(`ID: ${b.id}, Name: ${b.name}`);
    }
}
inspect();
