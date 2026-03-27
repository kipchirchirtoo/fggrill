const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGEMENT
FGS 001	LAWRENCE NGENO	MANAGEMENT	15,000
  CASHIERS
FGS 002	SHARON CHEROTICH	CASHIERS	10,000
FGS 003	CYNTHIA CHEPKEMOI	CASHIERS	10,000
  CHEFS (KITCHEN)
FGS 004	ISAAC OBWANA	CHEFS (KITCHEN)	15,000
  STEWARD (KITCHEN)
FGS 005	BRENDA CHESANG	STEWARD (KITCHEN)	8,000
FGS 006	COLLINS KOECH	STEWARD (KITCHEN)	10,000
  TEAM PLAYERS (CLUB)
FGS 007	FAITH CHEPKOECH	TEAM PLAYERS (CLUB)	10,000
  TEAM PLAYERS (RESTAURANT)
FGS 008	SHANICE CHEPKEMOI	TEAM PLAYERS (RESTAURANT)	10,000
FGS 009	FAITH CHEBET	TEAM PLAYERS (RESTAURANT)	10,000
  TEAM SAUNA
FGS 010	MERCY CHEPKIRUI	TEAM SAUNA	10,000
FGS 011	PHOEBE CHEPKOECH	TEAM SAUNA	9,000
FGS 012	GIBSON KOECH	TEAM SAUNA	9,000
FGS 013	SHADRACK KOSKEI	TEAM SAUNA	6,097
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('HOUSE KEEPING') || dept.includes('CLEANER')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('DISPENSE') || dept.includes('STEWARD') || dept.includes('(RESTAURANT)') || dept.includes('(KITCHEN)')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB') || dept.includes('SAUNA')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE') || dept.includes('TECHNICIAN')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN') || dept.includes('FINANCE') || dept.includes('CONTROLLER') || dept.includes('CASHIER') || dept.includes('COUNTER')) return 'administration';
    
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    let currentDept = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Source') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;
        
        // Skip over section headers (they have no tabs)
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
                mapped_department: mapDepartment(role !== '—' ? role : currentDept),
                basic_salary: salary
            });
        }
    }
    return db;
}

async function run() {
    const employees = parseData();
    console.log("Parsed " + employees.length + " employees from Kaptote text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Kaptote branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%KAPTOTE%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG KAPTOTE BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG KAPTOTE BRANCH', 'KAP', 'Kaptote', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found KAPTOTE branch with ID " + branchId);
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
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Kaptote branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
