const { Client } = require('pg');
const crypto = require('crypto');

const rawData = `
FGK1	GIDEON KOSGEI	254705567305	MANAGER	20,000
FGK2	FAITH CHERONO	254701508061	ACCOUNTANT	15,000
FGK3	KEVIN CHERUIYOT	254722888240	SUPERVISOR RESTAURANT	15,000
FGK4	ABEDNEG0 KIPKIRUI	254709918867	SUPERVISOR CLUB	15,000
FGK5	MERCY CHEPNGETICH	—	RECEPTIONIST	12,000
FGK6	GLADYS CHEMUTAI	254727738439	BAR LADY	12,000
FGK7	MERCY CHEROTICH	254726022120	BAR LADY	12,000
FGK8	SHARON CHEPKEMOI	254746425636	STOREKEEPER	12,000
FGK9	FAITH CHEPKORIR	254727024592	WAITER	10,000
FGK10	FAITH CHEPCHUMBA	254757575610	WAITER	10,000
FGK11	SHEILA CHEPKOECH	254701476511	WAITER	10,000
FGK12	MERCY CHEPKEMOI	254719676307	WAITER	10,000
FGK13	MERCY BIRIT	254729993001	WAITER	10,000
FGK14	WELDON CHEBET	254707012521	WAITER	10,000
FGK15	GLORIA CHEBET	254707252597	WAITER	10,000
FGK16	DIANA CHERONO	254726059537	WAITER	10,000
FGK17	ANGELINE OSORO	254726596165	WAITER	10,000
FGK18	MERCY CHEROTICH	254791226839	WAITER	10,000
FGK19	MILKA CHERONO	254743792085	WAITER	10,000
FGK20	BRENDA CHEBET	254708463837	WAITER	10,000
FGK21	FAITH CHEROTICH	254722386691	WAITER	10,000
FGK22	MERCY CHELANGAT	254703850483	WAITER	10,000
FGK23	NATASHA CHEPKORIR	254746375395	WAITER	10,000
FGK24	EVERLINE CHERONO	254703619741	CHEF	15,000
FGK25	VINCENT KIBET	254705990674	CHEF	15,000
FGK26	BEN KIRUI	254725206010	CHEF	15,000
FGK27	JOSPHAT MUTAI	254740639522	CHEF	12,000
FGK28	RODGERS ROTICH	254792746200	CHEF	15,000
FGK29	REUBEN KIPTANUI	254701037601	CHEF	15,000
FGK30	DOREEN CHEPKOECH	254702288990	PASTRY	12,000
FGK31	VICTOR KIRUI	254791759672	DISPENSER	12,000
FGK32	LAUREEN CHEPKORIR	254710914836	DISPENSER	12,000
FGK33	DENNIS KOECH	254703516353	SPA/KINYOZI	11,300
FGK34	JOSPHINE CHEPKEMOI	254713985527	SPA/KINYOZI	11,300
FGK35	MERCY CHELANGAT	254726372635	SAUNA	10,000
FGK36	VALENTINE CHEROTICH	254708407249	SAUNA	9,000
FGK37	HANS RONO	254706754508	SAUNA	9,000
FGK38	GILBERT LANGAT	254757517190	SAUNA	9,000
FGK39	ENOCK KIPNGETICH	254796191981	SAUNA	9,000
FGK40	HENRY KEMBOI	254702140457	CARWASH	13,180
FGK41	ABRAHAM KORIR	254700907152	CARWASH	11,440
FGK42	JENNIFFER CHEPTOO	254717999564	STEWARD	9,000
FGK43	MERCY CHEPKEMOI	254115835018	WASHUP	8,000
FGK44	LILIAN CHEPKIRUI	254725498628	WASHUP	8,000
FGK45	MERCY CHERONO	254705584191	WASHUP	8,000
FGK46	JOAN CHEPNGETICH	254719378306	WASHUP	8,000
FGK47	FAITH CHEPNGENO	254726522730	HOUSEKEEPING	8,000
FGK48	BENSON TERER	254791711203	CLEANER	8,000
FGK49	KEVIN KIBET	254712544734	CLEANER	8,000
FGK50	DOMINIC KIBET	254727035788	CLEANER	8,000
FGK51	ERICK MUTAI	254112680354	CLEANER	8,000
FGK52	SAMSON KORIR	254708788211	SECURITY	9,000
FGK53	ENOCK NGENO	254714617633	SECURITY	8,000
FGK54	TEVIN OMBIMA	254707545934	ENTERTAINMENT	8,000
FGK55	VICTOR KIPKIRUI	254720403414	TRANSPORTER	15,000
`;

function mapDepartment(dept) {
    dept = dept.toUpperCase();
    if (dept.includes('HOUSEKEEPING') || dept.includes('CLEANER') || dept.includes('WASHUP')) return 'housekeeping';
    if (dept.includes('WAITER') || dept.includes('CHEF') || dept.includes('PASTRY') || dept.includes('DISPENSER') || dept.includes('RESTAURANT')) return 'restaurant';
    if (dept.includes('BAR') || dept.includes('CLUB')) return 'bar_lounge';
    if (dept.includes('RECEPTION')) return 'reception';
    if (dept.includes('SECURITY')) return 'security';
    if (dept.includes('MAINTENANCE')) return 'maintenance';
    if (dept.includes('MANAGER') || dept.includes('ADMIN') || dept.includes('ACCOUNTANT')) return 'administration';
    
    // Steward, stores, SPA, SAUNA, CARWASH, ENTERTAINMENT, TRANSPORTER fallback
    return 'general';
}

function parseData() {
    const lines = rawData.split('\n');
    let db = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('TOTAL') || line.startsWith('Note:')) continue;
        
        const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 5) {
            let empNo = parts[0];
            let name = parts[1];
            let phone = parts[2];
            let role = parts[3];
            let salaryText = parts[4];

            if (phone === '—') phone = null;
            if (empNo === '—') empNo = null;
            
            let salary = parseInt(salaryText.replace(/,/g, '')) || 0;
            
            db.push({
                name: name,
                phone: phone,
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
    console.log("Parsed " + employees.length + " employees from Kaplong text.");

    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');
        
        let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%KAPLONG%'");
        let branchId;
        if (branchRes.rows.length === 0) {
            console.log('Inserting KAPLONG branch...');
            const iRes = await client.query("INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
                ['KAPLONG BRANCH', 'KAP', 'Kaplong', false, 'active']
            );
            branchId = iRes.rows[0].id;
        } else {
            branchId = branchRes.rows[0].id;
            console.log("Found KAPLONG branch with ID " + branchId);
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
                throw innerE; // Error explicitly to debug if constraint fails
            }
        }
        
        await client.query('COMMIT');
        console.log("Successfully inserted " + insertedProfiles + " staff profiles linked to Kaplong branch.");

    } catch(e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
