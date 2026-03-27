const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');

async function getFileData(filePath, parser) {
    const content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf('const rawData = `');
    if (startIdx === -1) return [];
    const endIdx = content.indexOf('`;', startIdx);
    const rawData = content.substring(startIdx + 17, endIdx);
    return parser(rawData);
}

function parseMogogoshiek(text) {
    const lines = text.split('\n');
    let db = [];
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;
        if (!/\t| {2,}/.test(line)) continue;
        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 5) {
            let empNo = parts[0] === '—' ? null : parts[0];
            let name = parts[1];
            let idNo = parts[3] === '—' ? null : parts[3];
            db.push({ name, empNo, idNo, branchTerm: 'MOGOG' });
        }
    }
    return db;
}

function parseKyogong(text) {
    const lines = text.split('\n');
    let db = [];
    for (let line of lines) {
        line = line.trim();
        if (!line || !/\t| {2,}/.test(line)) continue;
        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 6) {
            let name = parts[0];
            let idNo = parts[2] === '—' || parts[2] === '-' ? null : parts[2];
            let empNo = parts[3] === '—' || parts[3] === '-' ? null : parts[3];
            db.push({ name, empNo, idNo, branchTerm: 'KYOGONG' });
        }
    }
    return db;
}

function parseKaplong(text) {
    const lines = text.split('\n');
    let db = [];
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:')) continue;
        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 5) {
            let empNo = parts[0] === '—' ? null : parts[0];
            let name = parts[1];
            db.push({ name, empNo, idNo: null, branchTerm: 'KAPLONG' });
        }
    }
    return db;
}

function parseKapsoit(text) {
    const lines = text.split('\n');
    let db = [];
    for (let line of lines) {
        line = line.trim();
        if (!line || !/\t| {2,}/.test(line)) continue;
        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 4) {
            let empNo = parts[0] === '—' ? null : parts[0];
            let name = parts[1];
            db.push({ name, empNo, idNo: null, branchTerm: 'KAPSOIT' });
        }
    }
    return db;
}

async function fixDB() {
    console.log("Starting DB fix v3...");
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');

        const p1 = await getFileData('./import_mogogoshiek.js', parseMogogoshiek);
        const p2 = await getFileData('./import_kyogong.js', parseKyogong);
        const p3 = await getFileData('./import_kaplong.js', parseKaplong);
        const p4 = await getFileData('./import_kapsoit.js', parseKapsoit);
        
        const allEmployees = [...p1, ...p2, ...p3, ...p4];
        console.log(`Loaded ${allEmployees.length} employees from files.`);

        let updated = 0;

        for (let emp of allEmployees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';

            const branchPattern = '%' + emp.branchTerm + '%';

            const staffRes = await client.query(`
                SELECT sp.id, sp.id_number, sp.national_id 
                FROM staff_profiles sp
                JOIN branches b ON sp.branch_id = b.id
                WHERE b.name ILIKE $1 
                AND sp.first_name = $2 
                AND sp.last_name = $3
                LIMIT 1
            `, [branchPattern, firstName, lastName]);

            if (staffRes.rows.length > 0) {
                const row = staffRes.rows[0];
                let newIdNumber = emp.empNo || row.id_number; 
                let newNationalId = emp.idNo || null;

                if (!emp.empNo && row.id_number && !row.id_number.startsWith('PENDING') && row.id_number === newNationalId) {
                    newIdNumber = 'PENDING-' + crypto.randomBytes(4).toString('hex');
                }

                if (row.id_number !== newIdNumber || row.national_id !== newNationalId) {
                    await client.query(`
                        UPDATE staff_profiles 
                        SET id_number = $1, national_id = $2
                        WHERE id = $3
                    `, [newIdNumber, newNationalId, row.id]);
                    updated++;
                }
            } else {
                console.log(`Could not find in DB: ${emp.name} (${emp.branchTerm})`);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ Fixed mapping for ${updated} staff profiles.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixDB();
