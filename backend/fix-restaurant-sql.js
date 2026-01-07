const fs = require('fs');
const path = require('path');

const migrationsDir = 'c:\\Users\\25471\\OneDrive\\Desktop\\fggrill\\backend\\supabase\\migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') || f.endsWith('.sql.txt'));

files.forEach(file => {
    const filePath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Fix staff references
    if (content.match(/REFERENCES\s+staff\s*\(/gi)) {
        content = content.replace(/REFERENCES\s+staff\s*\(/gi, 'REFERENCES staff_profiles(');
        modified = true;
    }

    // 2. Fix branch_id type mismatch
    if (content.match(/branch_id\s+UUID\s+REFERENCES\s+branches\(id\)/gi)) {
        content = content.replace(/branch_id\s+UUID\s+REFERENCES\s+branches\(id\)/gi, 'branch_id INTEGER REFERENCES branches(id)');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`Patched: ${file}`);
    }
});
