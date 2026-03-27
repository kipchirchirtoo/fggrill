const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const BRANCH_ID = 1;

const roomTypesData = [
  { name: 'Standard', base_price: 3000, max_occupancy: 2, code: 'STD' },
  { name: 'Deluxe', base_price: 3500, max_occupancy: 2, code: 'DLX' },
  { name: 'Deluxe Twin', base_price: 5000, max_occupancy: 2, code: 'DTW' },
  { name: 'Executive', base_price: 5500, max_occupancy: 2, code: 'EXE' },
  { name: 'VIP Suite', base_price: 8000, max_occupancy: 1, code: 'VIP' },
  { name: 'Cottage', base_price: 8000, max_occupancy: 1, code: 'CTG' }
];

const roomsData = [
  { type: 'Deluxe', rooms: ['FG01', 'FA01', 'FA02', 'FA03', 'FA04', 'FA05', 'FA07', 'FA08', 'FA13', 'FB01', 'FB02', 'FB03', 'FB04', 'FB05', 'FB06', 'FB07', 'FB08', 'FB13'] },
  { type: 'Standard', rooms: ['FG47', 'FG48', 'FG49', 'FG50', 'FG51', 'FG52', 'FG53', 'FG54', 'FG55', 'FG56', 'FG57', 'FG58', 'FG59', 'FG60', 'FG61', 'FG62', 'FG63', 'FG64', 'FG65', 'FG66', 'FG67'] },
  { type: 'Deluxe Twin', rooms: ['FA10', 'FA11', 'FB17', 'FB18'] },
  { type: 'Executive', rooms: ['FA09', 'FB09', 'FB10', 'FB11', 'FB12', 'FB15', 'FB16', 'FB19', 'FB20', 'FC02', 'FC01-A', 'FC01-B'] },
  { type: 'VIP Suite', rooms: ['FB14'] },
  { type: 'Cottage', rooms: ['COTTAGE-01'] }
];

const hallsData = [
  { name: 'SINAI HALL', capacity: 100, price: 15000 },
  { name: 'GARDEN HALL', capacity: 200, price: 25000 },
  { name: 'BOARDROOM', capacity: 20, price: 10000 },
  { name: 'NEXT TO BOARDROOM', capacity: 15, price: 8000 },
  { name: 'OLIVE HALL', capacity: 50, price: 12000 },
  { name: 'DINING HALL', capacity: 150, price: 20000 },
  { name: 'ZION HALL', capacity: 80, price: 18000 }
];

async function runImport() {
  const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('--- Cleaning Up ---');
    await client.query('DELETE FROM conference_halls WHERE branch_id = $1', [BRANCH_ID]);
    await client.query('DELETE FROM rooms WHERE branch_id = $1', [BRANCH_ID]);

    console.log('--- Importing Room Types ---');
    const typeMap = {};
    for (const rt of roomTypesData) {
      const existing = await client.query('SELECT id FROM room_types WHERE name = $1', [rt.name]);
      if (existing.rows.length > 0) {
        await client.query('UPDATE room_types SET base_price = $1, max_occupancy = $2, code = $3 WHERE id = $4', 
          [rt.base_price, rt.max_occupancy, rt.code, existing.rows[0].id]);
        typeMap[rt.name] = existing.rows[0].id;
      } else {
        const insertRes = await client.query('INSERT INTO room_types (name, base_price, max_occupancy, code, active) VALUES ($1, $2, $3, $4, true) RETURNING id', 
          [rt.name, rt.base_price, rt.max_occupancy, rt.code]);
        typeMap[rt.name] = insertRes.rows[0].id;
      }
      console.log(`- Room Type: ${rt.name} (ID: ${typeMap[rt.name]})`);
    }

    console.log('--- Importing Rooms ---');
    let roomCount = 0;
    for (const rData of roomsData) {
      const typeId = typeMap[rData.type];
      for (const roomNum of rData.rooms) {
        await client.query(`
          INSERT INTO rooms (room_number, type_id, branch_id, status, floor, active, amenities)
          VALUES ($1, $2, $3, 'available', 1, true, '{}')
        `, [roomNum, typeId, BRANCH_ID]);
        roomCount++;
      }
    }
    console.log(`- Imported ${roomCount} rooms.`);

    console.log('--- Importing Conference Halls ---');
    for (const hall of hallsData) {
      await client.query(`
        INSERT INTO conference_halls (branch_id, name, capacity, base_price_per_day, base_price_per_hour, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
      `, [BRANCH_ID, hall.name, hall.capacity, hall.price, 0]);
    }
    console.log(`- Imported ${hallsData.length} conference halls.`);

    await client.query('COMMIT');
    console.log('\nKyogong Import Completed Successfully!');

  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error('Import Error:', e.message);
  } finally {
    await client.end();
  }
}

runImport();
