const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGEMENT / CASHIERS
FGB1	GEOFREY KIBET	—	—	—	MANAGEMENT	20,000
FGB2	AMOS KEMBOI	—	33141146	5042024002	CASHIERS	15,000
FGB3	SANDRA LANGAT	—	38469595	5040271403	CASHIERS	14,000
FGB4	AMOS CHERUIYOT	—	41399633	5040282000	CASHIERS	11,000
FGB5	EVANS KIPROTICH KOSKEI	—	—	—	CASHIERS	11,000
FGB6	JOAN CHEPNGETICH TONUI STORE	254729835625	—	—	STORES	6,400
  CHEFS / DESPENSE
FGB7	EZEKIEL KIGEN	—	41681773	5042460402	CHEF	15,000
FGB8	BENARD KIPTOO	—	33718600	5042339502	CHEF	14,000
FGB9	KEVIN KIPLANGAT	—	26603322	5042036802	CHEF	14,000
FGB10	EZRA KIPRONO BYEGON	—	37737946	5042551602	DESPENSE	14,000
FGB11	CYNTHIA CHELANGAT LANGAT	—	25419786	5042023702	DESPENSE	8,500
  WAITERS / WAITRESSES
FGB12	NICHOLAS KIPYEGON	—	28114677	5042261302	WAITER	8,500
FGB13	JOYCE CHEPKORIR	—	—	—	WAITER	10,000
FGB14	MERCY CHEBET	—	—	—	WAITER	10,000
FGB15	ELIUD ROTICH	—	—	—	WAITER	10,000
FGB16	OLIVER KIPKOECH	—	—	—	WAITER	10,000
  CLUB
FGB17	OSCEN LANGAT	—	—	—	CLUB	15,000
FGB18	LENAH SIGEI	—	—	—	CLUB	10,000
FGB19	SHARON MORAA	—	—	—	CLUB	10,000
FGB20	JACKLINE KIGET	—	—	—	CLUB	10,000
FGB21	MERCY/LINE CHEPKEMOI	—	—	—	CLUB	10,000
FGB22	SOPHIE CHEBET	—	—	—	CLUB	10,000
FGB23	IVINE CHEPNGETICH	—	—	—	CLUB	10,000
FGB24	MERCY BYEGON	—	—	—	CLUB	10,000
  CLEANER / WASH UP / ROOMS
FGB25	NAOMI CHEPNGENO	—	39905830	5042212602	CLEANER	8,500
FGB26	JOAN CHEPKEMOI BETT	—	—	—	CLEANER	8,500
FGB27	MERCY CHELANGAT	—	—	—	CLEANER	8,500
FGB28	SHARON CHEPKIRUI	—	—	—	CLEANER	8,500
FGB29	VIOLA CHELANGAT	254470497044	—	—	CLEANER	8,500
FGB30	RONALD	254726540594	—	—	CLEANER	8,500
FGB31	DENNIS	254797958777	—	—	CLEANER	8,500
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('CLEANER') || dept.includes('ROOMS') || dept.includes('WASH UP')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('WAITRESS') || dept.includes('CHEF') || dept.includes('DESPENSE') || dept.includes('DISPENSE')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN') || dept.includes('CASHIER')) return 'administration';
    
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
        if (parts.length >= 7) {
            let empNo = parts[0];
            let name = parts[1];
            let phone = parts[2];
            let idNo = parts[3];
            let accountNo = parts[4];
            let role = parts[5];
            let salaryText = parts[6];

            if (empNo === '—') empNo = null;
            if (phone === '—') phone = null;
            if (idNo === '—') idNo = null;
            if (accountNo === '—') accountNo = null;
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            db.push({
                name: name,
                phone: phone,
                idNo: idNo,
                accountNo: accountNo,
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
    console.log("Parsed " + employees.length + " employees from Bomet Town text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Bomet Town branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%BOMET%TOWN%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG BOMET TOWN BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG BOMET TOWN BRANCH', 'BOM', 'Bomet', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found BOMET TOWN branch with ID " + branchId);
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
                    await client.query(`
                        INSERT INTO staff_profiles (
                            role, department, shift, basic_salary, start_date, 
                            id_number, national_id, phone, first_name, last_name, position, branch_id, account_number
                        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $11, $6, $7, $8, $9, $10, $12)
                    `, [
                        emp.role, emp.mapped_department, 'morning', emp.basic_salary,
                        safeIdNo, emp.phone, firstName, lastName, emp.role, branchId, nationalId, emp.accountNo
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
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Bomet Town branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
