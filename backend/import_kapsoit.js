const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGEMENT
FGKA001	BONIFACE KIRUI	MANAGEMENT	25,000
FGKA002	GEOFFREY KOECH	MANAGEMENT	15,000
FGKA003	SHARON CHEPNGENO	MANAGEMENT	19,000
  RECEPTIONIST
FGKA004	BETTY CHERONO	RECEPTIONIST	13,000
FGKA005	BRENDA CHEBET	RECEPTIONIST	12,000
  STORES
FGKA006	VIVIAN CHEPKONGA	STORES	12,000
  RELIEVER
FGKA007	MERCY CHEROTICH	RELIEVER	11,000
FGKA008	BELLAH CHEPKORIR	RELIEVER	12,000
  WAITERS
FGKA009	MERCY JEMUTAI	WAITERS	10,000
FGKA010	JACKLINE CHEPKIRUI	WAITERS	10,000
FGKA011	CAREN CHEPTOO	WAITERS	10,000
FGKA012	SHEILAH CHEPKORIR	WAITERS	10,000
FGKA013	DAISY CHELANGAT	WAITERS	10,000
FGKA014	VINCENT SANG	WAITERS	10,000
FGKA015	YUNICAH CHEPKEMOI	WAITERS	10,000
FGKA016	STELLAH CHEBET	WAITERS	10,000
FGKA017	NELLY CHEPNGETICH	WAITERS	10,000
FGKA018	TABITHA CHEROTICH	WAITERS	10,000
FGKA019	VIOLA CHEPKIRUI	WAITERS	10,000
  CHEFS
FGKA020	SYLVESTER KIPNGENO	CHEFS	12,000
FGKA021	EVANS KETER	CHEFS	14,000
FGKA022	ROSE NASHIPAE	CHEFS	14,000
FGKA023	JOYLINE CHEPNGETICH	CHEFS	12,000
FGKA024	GILBERT RONO	CHEFS	12,000
  DISPENSE
FGKA025	EMMANUEL ROTICH	DISPENSE	10,000
FGKA026	MERCY CHEPKORIR	DISPENSE	10,000
  STEWARDS
FGKA027	SHEILA CHEPKEMOI	STEWARDS	8,000
FGKA028	SHARON CHELANGAT	STEWARDS	8,000
FGKA029	MERCY CHEPNGETICH	STEWARDS	8,000
FGKA030	FAITH CHEPNGETICH	STEWARDS	8,000
  H/S (HOUSEKEEPING)
FGKA031	GLORIA CHEPTOO	H/S (HOUSEKEEPING)	9,000
  CLEANERS
FGKA032	VICTOR KIPKORIR	CLEANERS	8,000
FGKA033	GIDEON KIPLANGAT	CLEANERS	8,000
FGKA034	JOHN WAWERU	CLEANERS	10,000
  SPA
FGKA035	MATHIAS	SPA	18,954
FGKA036	JANICE CHEPKORIR	SPA	2,248
FGKA037	CHEBET FAITH	SPA	9,208
  SAUNA
FGKA038	TRIZAH RHESHY	SAUNA	10,000
FGKA039	CYNTHIA CHEPTOO	SAUNA	10,000
FGKA040	ENOCK KIPRONO	SAUNA	9,000
FGKA041	KEVIN ROTICH	SAUNA	9,000
FGKA042	GIDEON MARITIM	SAUNA	9,000
  SECURITY
FGKA043	BENARD KIKURUI	SECURITY	8,000
  ENTERTAINMENT
FGKA044	COLLINS KIRUI (DJ)	ENTERTAINMENT	15,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('CLEANER') || dept.includes('WASHUP') || dept.includes('H/S')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('PASTRY') || dept.includes('DISPENSER') || dept.includes('RESTAURANT') || dept.includes('DISPENSE')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN') || dept.includes('ACCOUNTANT')) return 'administration';
    
    // Steward, stores, SPA, SAUNA, CARWASH, ENTERTAINMENT, TRANSPORTER, RELIEVER fallback
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:')) continue;
        
        // Skip over section headers
        if (!/\t| {2,}/.test(line)) {
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
                role: role,
                department: role,
                mapped_department: mapDepartment(role),
                basic_salary: salary
            });
        }
    }
    return db;
}

async function run() {
    const employees = parseData();
    console.log("Parsed " + employees.length + " employees from Kapsoit text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Kapsoit branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%KAPSOIT%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG KAPSOIT BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG KAPSOIT BRANCH', 'KAPS', 'Kapsoit', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found KAPSOIT branch with ID " + branchId);
        }

        let insertedProfiles = 0;

        for (const emp of employees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            const safeIdNo = ('PENDING-' + crypto.randomBytes(4).toString('hex'));
            
            try {
                await client.query("INSERT INTO staff_profiles (role, department, shift, basic_salary, start_date, id_number, phone, first_name, last_name, position, branch_id) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10)", 
                [
                    emp.role, emp.mapped_department, 'morning', emp.basic_salary,
                    safeIdNo, emp.phone, firstName, lastName, emp.role, branchId
                ]);
                
                insertedProfiles++;
            } catch (innerE) {
                console.error("Failed to insert profile for " + emp.name + ": " + innerE.message);
                throw innerE; // Error explicitly to debug if constraint fails
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " staff profiles linked to Kapsoit branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
