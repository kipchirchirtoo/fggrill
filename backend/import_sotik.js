const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
FGD001	BISMARK KOECH	16,000
FGD002	EVANS KORIR	13,000
FGD003	VIOLET CHEBET	10,000
FGD004	COLLINS KIGEN	12,000
FGD005	FANCY CHEMUTAI	10,000
FGD006	MOUREEN MORAA	10,000
FGD007	MERCY CHEPKIRUI	10,000
FGD008	SYLVESTER MUTAI	9,000
FGD009	DJ EVANS	15,000
`;

function mapDepartment(dept) {
    dept = (dept || '').toUpperCase();
    if (dept.includes('DJ') || dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Source') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;

        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 3) {
            let empNo = parts[0];
            let name = parts[1];
            let salaryText = parts[2];

            if (empNo === '—') empNo = null;
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            // Department is missing, but if name contains "DJ" we can classify
            let defaultRole = 'UNSPECIFIED';
            if (name.toUpperCase().includes('DJ')) {
                defaultRole = 'DJ';
            }
            
            db.push({
                name: name,
                phone: null,
                idNo: null,
                empNo: empNo,
                role: defaultRole,
                department: defaultRole,
                mapped_department: mapDepartment(defaultRole),
                basic_salary: salary
            });
        }
    }
    return db;
}

async function run() {
    const employees = parseData();
    console.log("Parsed " + employees.length + " employees from Sotik text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Sotik branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%SOTIK%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG SOTIK BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG SOTIK BRANCH', 'SOT', 'Sotik', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found SOTIK branch with ID " + branchId);
        }

        let insertedProfiles = 0;

        for (const emp of employees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            const safeIdNo = emp.empNo || ('PENDING-' + crypto.randomBytes(4).toString('hex'));
            const nationalId = emp.idNo || null;
            
            try {
                // Check if already exists
                const existing = await client.query('SELECT id FROM staff_profiles WHERE id_number = $1 AND branch_id = $2', [safeIdNo, branchId]);
                
                if (existing.rows.length === 0) {
                    await client.query("INSERT INTO staff_profiles (role, department, shift, basic_salary, start_date, id_number, national_id, phone, first_name, last_name, position, branch_id) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $11, $6, $7, $8, $9, $10)", 
                    [
                        emp.role, emp.mapped_department, 'morning', emp.basic_salary,
                        safeIdNo, emp.phone, firstName, lastName, emp.role, branchId, nationalId
                    ]);
                    insertedProfiles++;
                } else {
                    console.log(`Skipping duplicate: ${emp.name} (${safeIdNo})`);
                }
            } catch (innerE) {
                console.error("Failed to insert profile for " + emp.name + ": " + innerE.message);
                throw innerE;
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Sotik branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
