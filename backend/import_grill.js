const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  MANAGEMENT
FGG01	GEOFERY RUTO	MANAGEMENT	—
FGG02	FERDRICK ROTICH	MANAGEMENT	—
FGG03	JOAN KONGA	MANAGEMENT	—
  STEWARDS
FGG04	HENRITA CHEPKIRUI	STEWARDS	8,000
FGG05	GLADYS CHERONO	STEWARDS	8,000
FGG06	JUDY CHEPNGENO	STEWARDS	8,000
FGG07	DAISY CHEBET	STEWARDS	8,000
FGG08	DOREEN CHERONO	STEWARDS	8,000
  WAITERS / WAITERESSES
FGG09	LOURINE CHEROTICH	WAITERS / WAITERESSES	10,000
FGG10	KHADIJA CHEPCHIRCHIR	WAITERS / WAITERESSES	10,000
FGG11	GEOFERY LANGAT	WAITERS / WAITERESSES	10,000
FGG12	ALPHONSE YEGON	WAITERS / WAITERESSES	10,000
FGG13	FAITH MUTAI	WAITERS / WAITERESSES	10,000
FGG14	LILIAN ANYANGO	WAITERS / WAITERESSES	10,000
  CHEFS
FGG15	EVANCE KOECH	CHEFS	15,000
FGG16	COSMAS TOO	CHEFS	13,000
FGG17	BENARD KIPLANGAT	CHEFS	13,000
FGG18	SHADRACK NYABERI	CHEFS	13,000
FGG19	AUNTONENTA KERUBO	CHEFS	15,000
FGG20	VINCENT KIPKOECH	CHEFS	17,000
FGG21	GILBERT KIPLANGAT	CHEFS	15,000
FGG22	DAISY CHELANGAT	CHEFS	12,000
FGG23	VIOLA CHEPNGENO	CHEFS	10,000
  DISPENSE
FGG24	EZRA BYEGON	DISPENSE	10,000
FGG25	RONNY KIPRUTO	DISPENSE	10,000
  BARBERSHOP / SALON / SPA
FGG26	DESMOND KIPRUTO	BARBERSHOP / SALON / SPA	9,260
FGG27	ANGEL MUGESHA	BARBERSHOP / SALON / SPA	19,220
FGG28	CLINTON ROTICH	BARBERSHOP / SALON / SPA	20,992
FGG29	VALARY CHEPKEMOI	BARBERSHOP / SALON / SPA	10,850
  HOUSEKEEPING / PUBLIC AREA
FGG30	SHARON CHEPKORIR	HOUSEKEEPING / PUBLIC AREA	9,000
FGG31	DOREEN CHEPTOO	HOUSEKEEPING / PUBLIC AREA	8,000
FGG32	GIDEON KIPROTICH	HOUSEKEEPING / PUBLIC AREA	8,000
FGG33	FESTUS CHEPKWOY	HOUSEKEEPING / PUBLIC AREA	8,000
FGG34	HILLARY KIBET KOECH	HOUSEKEEPING / PUBLIC AREA	8,000
  CLUB
FGG35	THABITHA	CLUB	5,000
FGG36	FELIX KOECH	CLUB	12,000
FGG37	VICKY CHEROP	CLUB	10,000
FGG38	ALICE KERUBO	CLUB	10,000
FGG39	COLLINS MAMBO	CLUB	21,964
FGG40	MERCY KOECH	CLUB	10,000
  STORES / PROCUREMENT
FGG41	JUNE CHEBET	STORES / PROCUREMENT	12,000
FGG42	MERCY CHELANGAT	STORES / PROCUREMENT	13,000
FGG43	MILICENT CHEROTICH	STORES / PROCUREMENT	12,000
  CAR WASH
FGG44	PHILEMON RUTO	CAR WASH	10,000
  SECURITY / TRANSPORTER
FGG45	DICKSON	SECURITY / TRANSPORTER	8,000
FGG46	VICTOR RONO	SECURITY / TRANSPORTER	8,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('CLEANER') || dept.includes('PUBLIC AREA')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('DISPENSE') || dept.includes('STEWARD')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB') || dept.includes('SALON') || dept.includes('SPA')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN')) return 'administration';
    
    // Stores, Car Wash fallback
    if (dept.includes('STORE') || dept.includes('CAR WASH')) return 'general';
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    let currentDept = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;
        
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
    console.log("Parsed " + employees.length + " employees from Grill text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure Grill branch exists
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%GRILL%' OR name ILIKE '%KERICHO GRILL%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting FG GRILL BRANCH...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['FG GRILL BRANCH', 'GRI', 'Kericho', true, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found GRILL branch with ID " + branchId);
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
        console.log("Successfully inserted " + insertedProfiles + " new staff profiles linked to Grill branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
