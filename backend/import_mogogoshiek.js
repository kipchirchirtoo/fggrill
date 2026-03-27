const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
  STEWARDS (RESTAURANT)
FGM01	DENNIS KORIR	254718308736	34148829	22,000
FGM02	GIDEON K CHELULE	254724927576	35856368	18,000
FGM03	HARRISON RUTTO	254722209144	—	20,000
FGM04	CHEPKEMOI LANGAT SHEILA	254724329668	39871425	10,000
FGM05	SHEILA CHEPKOECH	254707124066	—	8,000
FGM06	JOYLYNE CHEPKEMOI	—	—	8,000
FGM07	SHARON CHEPNGETICH	—	39793108	8,000
  WAITERS
FGM08	DORCAS CHEPKORIR	254715211659	41985487	10,000
FGM09	JEMIMA CHELANGAT	254115916976	41765917	10,000
FGM10	NAOMI CHEPKEMOI	254796090402	38953934	10,000
FGM11	MERCY CHEPNGETICH BAR	254715380486	36361076	10,000
  CHEFS
FGM12	LINET CHERONO	254726889551	39239008	15,000
FGM13	MARK TOO	254113004084	42681777	15,000
FGM14	CARLOS KORIR	254719461371	32155671	15,000
FGM15	EMMANUEL BETT	254718375159	38961491	15,000
  DISPENSE
FGM16	MERCY CHEPNGETICH	254725864211	38491698	10,000
FGM17	PAUL DENNIS ROTICH	254727057177	31008881	9,000
FGM18	DENNIS NGETICH	254769986488	109157972	9,000
  DJ
FGM19	LUKAS MATENDE	254740009392	40642629	18,000
  CLUB
FGM20	KENDY CHEBET	254114340124	41596522	10,000
FGM21	LAWRENCE KIBET	254758573699	—	10,000
FGM22	LYNN CHERONO	254723291599	—	10,000
  CASHIERS
FGM23	PERIS CHEPNGETICH	254728574537	37898007	12,000
FGM24	FAITH CHERONO	254748659439	38411450	12,000
FGM25	STARCY JELAGAT	254794096714	38147261	12,000
FGM26	JOY CHEPKOECH	254710656187	38999099	12,000
FGM27	ROBERT KIPKOECH	254717611654	33377329	8,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('CLEANER')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('WAITERS') || dept.includes('CHEF') || dept.includes('CHEFS') || dept.includes('DISPENSE') || dept.includes('STEWARDS')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB') || dept.includes('DJ')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('MANAGEMENT') || dept.includes('ADMIN') || dept.includes('CASHIER') || dept.includes('CASHIERS')) return 'administration';
    
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
        if (parts.length >= 5) {
            let empNo = parts[0];
            let name = parts[1];
            let phone = parts[2];
            let idNo = parts[3];
            let salaryText = parts[4];

            if (empNo === '—') empNo = null;
            if (phone === '—') phone = null;
            if (idNo === '—') idNo = null;
            
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            db.push({
                name: name,
                phone: phone,
                idNo: idNo,
                empNo: empNo,
                role: currentDept,
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
    console.log("Parsed " + employees.length + " employees from Mogogoshiek text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%MOGOG%SHIEK%' OR name ILIKE '%MOGOG%SIEK%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            throw new Error('Mogogoshiek branch not found! Need to investigate restored db.');
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found MOGOGOSHIEK branch with ID " + branchId);
        }

        let insertedProfiles = 0;

        for (const emp of employees) {
            const nameParts = emp.name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            const safeIdNo = emp.empNo || ('PENDING-' + crypto.randomBytes(4).toString('hex'));
            const nationalId = emp.idNo || null;
            
            try {
                await client.query("INSERT INTO staff_profiles (role, department, shift, basic_salary, start_date, id_number, national_id, phone, first_name, last_name, position, branch_id) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $11, $6, $7, $8, $9, $10)", 
                [
                    emp.role, emp.mapped_department, 'morning', emp.basic_salary,
                    safeIdNo, emp.phone, firstName, lastName, emp.role, branchId, nationalId
                ]);
                
                insertedProfiles++;
            } catch (innerE) {
                console.error("Failed to insert profile for " + emp.name + ": " + innerE.message);
                throw innerE; 
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " staff profiles linked to Mogogoshiek branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
