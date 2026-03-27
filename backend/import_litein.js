const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGEMENT
FGL001	JOSEPH KURGAT	MANAGEMENT	30,000
FGL002	KOE STANLEY	MANAGEMENT	25,000
FGL003	HILLARY KIRUI	MANAGEMENT	14,000
  FINANCE CONTROLLER
FGL004	GILBERT LANGAT	FINANCE CONTROLLER	30,000
  CASHIERS / COUNTER
FGL005	CHERONO AUGUSTICA	CASHIERS / COUNTER	14,000
FGL006	JACKLINE TOWETT	CASHIERS / COUNTER	13,000
FGL007	FAITH CHEBET	CASHIERS / COUNTER	13,000
FGL008	LILIAN CHEPKORIR	CASHIERS / COUNTER	12,000
  STORES
FGL009	EVANS BETT	STORES	12,000
FGL010	MERCY CHEPNGENO ONB	STORES	12,000
  DISPENSE
FGL011	ENOCK KIPRONO	DISPENSE	14,000
FGL012	HARON NGENO	DISPENSE	12,000
  CHEFS
FGL013	WINNY CHELANGAT	CHEFS	17,000
FGL014	LEONARD KOECH	CHEFS	15,000
FGL015	MERCY CHEPTOO CHEF	CHEFS	15,000
FGL016	EVANS MURUNGA	CHEFS	17,000
FGL017	WILLIAM OMOLLO	CHEFS	14,000
FGL018	DICKSON LANGAT	CHEFS	12,000
FGL019	MICHAEL KOSKEI	CHEFS	15,000
  STEWARDS
FGL020	JOAN TOO	STEWARDS	10,000
FGL021	SHARON CHEPNGENO	STEWARDS	9,000
FGL022	WINNY LABOSO	STEWARDS	9,000
FGL023	JUDITH CHEPTOO	STEWARDS	9,000
FGL024	MERCY LANGAT	STEWARDS	9,000
  PUBLIC AREA
FGL025	BRITON ONYANGO	PUBLIC AREA	8,000
FGL026	KIPTOO DENNIS	PUBLIC AREA	8,000
FGL027	JOSPHAT TOO	PUBLIC AREA	9,000
FGL028	KIMUTAI RONO	PUBLIC AREA	8,000
FGL029	KEVIN KIPKOECH	PUBLIC AREA	8,000
FGL029B	LINCON RONOH	PUBLIC AREA	8,000
  HOUSEKEEPING
FGL030	JANETH CHEPKOECH	HOUSEKEEPING	13,000
  WAITERS CLUB
FGL031	CHEPNGENO MERCY	WAITERS CLUB	10,000
FGL032	JUDITH CHEROTICH	WAITERS CLUB	10,000
FGL033	BREANDA C	WAITERS CLUB	10,000
FGL034	EDNAH KWEYU	WAITERS CLUB	10,000
FGL035	CRYSTALS CHEPNGETICH	WAITERS CLUB	10,000
  WAITERS RESTAURANT
FGL036	IVINE CHEBET	WAITERS RESTAURANT	10,000
FGL037	NKIROTE (MERU)	WAITERS RESTAURANT	10,000
FGL038	MERCY CHEPKEMOI	WAITERS RESTAURANT	10,000
FGL039	BENARD KIPKIRUI	WAITERS RESTAURANT	10,000
FGL040	VIOLA CHEPKIRUI	WAITERS RESTAURANT	10,000
FGL041	RISPER CHEPCHIRCHIR	WAITERS RESTAURANT	10,000
FGL042	QUINTEER CHEPKIRUI	WAITERS RESTAURANT	10,000
FGL043	JOY CHEPNGETICH	WAITERS RESTAURANT	10,000
FGL044	MS CHERONO MERCY	WAITERS RESTAURANT	10,000
FGL045	VIVIAN CHEPKIRUI	WAITERS RESTAURANT	10,000
FGL046	MARION WANJIKU	WAITERS RESTAURANT	11,000
FGL047	VINCENT KIRUI	WAITERS RESTAURANT	10,000
  TRANSPORT
FGL048	MATHEW MUNAI	TRANSPORT	8,000
  TECHNICIANS
FGL049	KIBET BOUNCER	TECHNICIANS	17,000
FGL050	JAYDEN SALIM	TECHNICIANS	18,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('HOUSE KEEPING') || dept.includes('CLEANER') || dept.includes('PUBLIC AREA')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('DISPENSE') || dept.includes('STEWARD')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE') || dept.includes('TECHNICIAN')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN') || dept.includes('FINANCE') || dept.includes('CONTROLLER') || dept.includes('CASHIER') || dept.includes('COUNTER')) return 'administration';
    
    // Transport, Stores fallback
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
    console.log("Parsed " + employees.length + " employees from Litein text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Litein branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%LITEIN%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG LITEIN BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG LITEIN BRANCH', 'LIT', 'Litein', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found LITEIN branch with ID " + branchId);
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
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Litein branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
