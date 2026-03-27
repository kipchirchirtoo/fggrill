const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGER
FGHS001	ANN KARIUKI	MANAGER	20,000
  CHEFS
FGHS002	ERICK KORIR	CHEFS	14,000
FGHS003	HOSE MALEMA	CHEFS	12,000
  WAITERS
FGHS004	VIOLA CHEPKIRUI	WAITERS	10,000
FGHS005	JOYLINE ALOUCH	WAITERS	10,000
FGHS006	DAISY CHEPTOO	WAITERS	10,000
FGHS007	KENNEDY KIRUI	WAITERS	10,000
  RECEPTION
FGHS008	GLORIA CHEPKEMOI	RECEPTION	12,000
FGHS009	TABITHA CHEPNGENO	RECEPTION	10,000
  HOUSE KEEPING
FGHS010	FANCY CHEROTICH	HOUSE KEEPING	8,000
FGHS011	CAREEN CHERONO	HOUSE KEEPING	8,000
  STEWARD
FGHS012	CYNTHIA CHEBII	STEWARD	8,000
FGHS013	EZRA NGETICH	STEWARD	8,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSE KEEPING') || dept.includes('HOUSEKEEPING') || dept.includes('CLEANER')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('DISPENSE') || dept.includes('STEWARD')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN')) return 'administration';
    
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    let currentDept = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Source') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;
        
        // Skip over section headers
        if (!/\t| {2,}/.test(line)) {
            currentDept = line.replace(/^[\s-]+|[\s-]+$/g, '');
            continue;
        }

        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 4) {
            let empNo = parts[0];
            let name = parts[1];
            let role = parts[2];
            let salaryText = parts[3];

            if (empNo === '—') empNo = null;
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            db.push({
                name: name,
                phone: null,
                idNo: null,
                empNo: empNo,
                role: role !== '—' ? role : currentDept,
                department: currentDept,
                mapped_department: mapDepartment(currentDept),
                basic_salary: salary
            });
        }
    }
    return db;
}

async function run() {
    const employees = parseData();
    console.log("Parsed " + employees.length + " employees from Guest House text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Guest House branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%GUEST%HOUSE%' OR name ILIKE '%GUESTHOUSE%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG GUEST HOUSE BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG GUEST HOUSE BRANCH', 'GHS', 'Kericho', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found GUEST HOUSE branch with ID " + branchId);
        }

        let insertedProfiles = 0;

        for (const emp of employees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            const safeIdNo = emp.empNo || ('PENDING-' + crypto.randomBytes(4).toString('hex'));
            const nationalId = emp.idNo || null;
            
            try {
                // Check if already exists so we don't duplicate on re-runs
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
                throw innerE; // Error explicitly to debug if constraint fails
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Guest House branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
