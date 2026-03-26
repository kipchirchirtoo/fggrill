const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  HOUSEKEEPING
MAGRET CHEPNGETICH	0705419656	29700131	FGH013	HOUSEKEEPING	8,000
LEONARD NGETICH (PA)	0795060868	28952284	FGH014	HOUSEKEEPING	8,000
SUSAN CHEPKORIR-ANNEX	0720604730	28217044	FGH015	HOUSEKEEPING	9,000
EMMANUEL EWOI	—	29959300	FGH016	HOUSEKEEPING	8,000
BERNARD MUTAI	—	—	FGH017	HOUSEKEEPING	11,000
BEATRICE CHEPKOECH	0702444716	—	FGH018	HOUSEKEEPING	10,000
MERCY CHEPKOECH (PA)	0721457731	—	FGH019	HOUSEKEEPING	10,000
SAMUEL BETT	0713299927	21832004	FGH020	HOUSEKEEPING	13,000
CYNTHIA CHEKEMOI (ROOMS)	0727699201	32461040	FGH021	HOUSEKEEPING	9,000
ERICK LANGAT	0758175644	41674965	FGH022	HOUSEKEEPING	10,000
KELVIN NIPLAANAGITPOTTER	0792099750	36736903	FGH023	HOUSEKEEPING	10,000
JACKLINE CHEROTICH	—	—	FGH024	HOUSEKEEPING	9,000
SHEILA CHEPNGETICHI (LAUNDRY)	—	—	FGH025	HOUSEKEEPING	8,000
ROSE CHEPREMOI (LAUNDRY)	—	—	FGH026	HOUSEKEEPING	8,000
KELVIN OKROTH	0725499933	37231406	FGH027	HOUSEKEEPING	8,000
  WAITERS / WAITRESS
MERCY CHERONO	0795620303	32280605	FGH028	WAITERS / WAITRESS	12,000
ROSTILE CHEPNGENOH	—	40709592	FGH029	WAITERS / WAITRESS	10,000
SHARON CHEPKMOI	0798371324	—	FGH030	WAITERS / WAITRESS	10,000
FAITH CHEBET	—	—	FGH031	WAITERS / WAITRESS	10,000
FELISHA CHEPNGETICH	—	—	FGH032	WAITERS / WAITRESS	12,000
EDINAH OBIEIRO	—	—	FGH033	WAITERS / WAITRESS	10,000
EDITH CHEPTOO	—	—	FGH034	WAITERS / WAITRESS	10,000
SHEILA	—	—	FGH035	WAITERS / WAITRESS	10,000
VANE KEMUNTO	—	—	FGH036	WAITERS / WAITRESS	10,000
JACKLINE CHEROTICH	—	—	FGH037	WAITERS / WAITRESS	10,000
HARIET BICOTY	—	—	FGH038	WAITERS / WAITRESS	10,000
CAREN CHELANGAT	—	—	FGH039	WAITERS / WAITRESS	12,000
VENNY CHERONO	—	—	FGH040	WAITERS / WAITRESS	10,000
BECKY RUTTOH	—	—	FGH041	WAITERS / WAITRESS	10,000
MARRIAM CHEPKIRUI	—	—	FGH042	WAITERS / WAITRESS	10,000
MOUREEN CHEKORIRA	—	—	FGH043	WAITERS / WAITRESS	10,000
LUCAS OMOLO	0702412823	35809828	FGH044	WAITERS / WAITRESS	10,000
  CHEFS
DENNIS CHAIM	0708927874	25571948	FGH045	CHEFS	18,000
SCANDY CHEPKOECH	—	—	FGH046	CHEFS	0
BENARD KIBET KORIR-CHOMIA Z	—	—	FGH047	CHEFS	12,000
NICHOLAS MUTAI	—	—	FGH048	CHEFS	13,000
KELVIN CHERUIYOT	—	—	FGH049	CHEFS	12,000
EVARETTE SIMIYU	0723929899	24280324	FGH050	CHEFS	20,000
WESLEY LANGAT	0728166337	28306431	FGH051	CHEFS	15,000
PHILEMON RONO	—	—	FGH052	CHEFS	20,000
HARON MWAI	—	—	FGH053	CHEFS	15,000
HILLARY BETT	0728468829	25459648	FGH054	CHEFS	13,000
SCOVIA CHEPKEMOI	0115299790	26169318	FGH055	CHEFS	12,000
  FOOD PASS / DISPENSE
LORNAH CHEBET	—	—	FGH056	FOOD PASS / DISPENSE	12,000
TITUS	—	—	FGH057	FOOD PASS / DISPENSE	12,000
BRENDAH	—	—	FGH058	FOOD PASS / DISPENSE	12,000
  STEWARD
MERCY CHEPKIRUI	—	—	FGH059	STEWARD	9,000
JENNIFER ICHUNGWO	0791216823	31717964	FGH060	STEWARD	10,000
DIANA CHEPKIRUI	—	—	FGH061	STEWARD	8,000
FANCY CHELANGAT	—	—	FGH062	STEWARD	8,000
MILCAH CHEPKOECH	—	—	FGH063	STEWARD	8,000
MILLICET BYEGON	—	—	FGH064	STEWARD	8,000
JANETH CHEBET	0710411672	32367787	FGH065	STEWARD	8,000
  BAR TENDERS
WELDON LANGAT (DJ LANGI)	0727484383	—	FGH066	BAR TENDERS	10,000
  RECEPTION
MERCY CHEPKORIR	0721939807	26373235	FGH067	RECEPTION	20,000
CAREN H.K	—	—	FGH068	RECEPTION	15,000
SYSILIAH MORAA	0704854387	32937559	FGH069	RECEPTION	15,000
  SECURITY
LEONARD CHELULE	—	—	FGH070	SECURITY	10,000
HILLARY OKUMU	—	—	FGH071	SECURITY	11,000
  STORES
MERCY CHEPKEMOI	—	—	FGH072	STORES	12,000
FELIX YEGON	—	—	FGH073	STORES	20,000
RONNY LIQOUR STORE	—	—	FGH074	STORES	12,000
BRENDAH CHEPKURUI	—	—	FGH075	STORES	10,000
JANETH CHEPWAGEN	—	—	FGH076	STORES	10,000
SHARON CHEPKMOI	—	—	FGH077	STORES	12,000
DAVIS MUTAI	—	—	FGH078	STORES	10,000
  SWIMMING
WESLEY BETT-SWIMMING	—	—	FGH079	SWIMMING	12,000
  MAINTENANCE / OTHER
BOAZ CHEPKWONY	—	—	FGH080	MAINTENANCE / OTHER	23,000
FESTUS-RIDER	—	—	FGH081	MAINTENANCE / OTHER	8,000
DENNIS KIPLANGAT PLUMBER	—	—	FGH082	MAINTENANCE / OTHER	15,000
BROWNY	—	—	FGH083	MAINTENANCE / OTHER	10,000
ROBERT KIRUI-DRIVER TRACTOR	—	—	FGH084	MAINTENANCE / OTHER	12,000
  ADMIN
WALTER KOECH	—	—	FGH012	ADMIN	30,000
COLLINS SIELE	—	—	FGH011	ADMIN	25,000
GILBERT KOSKEI	—	—	FGH010	ADMIN	22,000
ALPHONCE ODHIAMBO	—	—	FGH009	ADMIN	20,000
CHRIS KIGEN	—	—	FGH008	ADMIN	15,000
BRAXON KIBET	—	—	FGH007	ADMIN	20,000
KIM	—	—	FGH006	ADMIN	20,000
JP SOFTWARE	—	—	FGH005	ADMIN	20,000
OKINA WASHINGTONE	0729464743	29667835	FGH004	ADMIN	25,000
BRENTON KORIR	—	—	FGH003	ADMIN	0
ANTHONY KOECH	—	—	FGH002	ADMIN	25,000
GABRIEL MWANZA	—	—	FGH001	ADMIN	0
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING')) return 'housekeeping';
    if (dept.includes('WAITERS') || dept.includes('CHEFS') || dept.includes('FOOD PASS')) return 'restaurant';
    if (dept.includes('BAR TENDERS')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('ADMIN')) return 'administration';
    // Steward, stores, swimming fallback
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    let currentDept = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // If it does not contain a tab, assume it's a section header
        if (!/\t| {2,}/.test(line)) {
            currentDept = line.replace(/^[\s-]+|[\s-]+$/g, '');
            continue;
        }

        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 6) {
            let name = parts[0];
            let phone = parts[1];
            let idNo = parts[2];
            let empNo = parts[3];
            let role = parts[4];
            let salaryText = parts[5];

            if (phone === '—') phone = null;
            if (idNo === '—') idNo = null;
            if (empNo === '—') empNo = null;
            
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            db.push({
                name: name,
                phone: phone,
                idNo: idNo,
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
    console.log("Parsed " + employees.length + " employees from text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%KYOGONG%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting KYOGONG branch...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['KYOGONG BRANCH', 'KYO', 'Kyogong', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found KYOGONG branch with ID " + branchId);
        }

        let insertedProfiles = 0;

        for (const emp of employees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            const safeIdNo = emp.idNo || ('PENDING-' + crypto.randomBytes(4).toString('hex'));
            
            try {
                // Removed departments lookup because it conflicts with name constraint

                await client.query("INSERT INTO staff_profiles (role, department, shift, basic_salary, start_date, id_number, phone, first_name, last_name, position, branch_id) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10)", 
                [
                    emp.role, emp.mapped_department, 'morning', emp.basic_salary,
                    safeIdNo, emp.phone, firstName, lastName, emp.role, branchId
                ]);
                
                insertedProfiles++;
            } catch (innerE) {
                console.error("Failed to insert profile for " + emp.name + ": " + innerE.message);
                throw innerE; // Error explicitly to debug if constraint fails again
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " staff profiles linked to Kyogong branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
