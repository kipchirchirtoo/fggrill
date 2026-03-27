const { Client } = require('pg');

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

function getNames() {
    const lines = rawData.split('\n');
    let namesMap = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:') || line.startsWith('EMP NO')) continue;
        if (!/\t| {2,}/.test(line)) continue;

        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 4) {
            let oldEmpNo = parts[0];
            let name = parts[1];
            
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            namesMap.push({
                oldEmpNo,
                firstName,
                lastName
            });
        }
    }
    return namesMap;
}

async function run() {
    const staffList = getNames();
    console.log("Parsed " + staffList.length + " employees.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        let branchIdObj = await client.query("SELECT id FROM branches WHERE name ILIKE '%LITEIN%' LIMIT 1");
        const branchId = branchIdObj.rows[0].id;
        
        let updatedCount = 0;
        
        for (let i = 0; i < staffList.length; i++) {
            const staff = staffList[i];
            const desiredIdNumber = 'FGL' + String(i + 1).padStart(3, '0');
            
            // Find by first_name and last_name in branch
            const staffRes = await client.query(`
                SELECT id, id_number FROM staff_profiles
                WHERE branch_id = $1 AND first_name = $2 AND last_name = $3
                LIMIT 1
            `, [branchId, staff.firstName, staff.lastName]);
            
            if (staffRes.rows.length > 0) {
                const row = staffRes.rows[0];
                if (row.id_number !== desiredIdNumber) {
                    await client.query('UPDATE staff_profiles SET id_number = $1 WHERE id = $2', [desiredIdNumber, row.id]);
                    console.log(`Updated ${staff.firstName} ${staff.lastName} from ${row.id_number} to ${desiredIdNumber}`);
                    updatedCount++;
                }
            } else {
                console.log(`Warning: Could not find ${staff.firstName} ${staff.lastName} in DB!`);
            }
        }
        
        await client.query('COMMIT');
        console.log(`Successfully re-indexed ${updatedCount} staff IDs to follow FGL001-FGL051.`);

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Error:', e.message);
    } finally {
        await client.end();
    }
}

run();
