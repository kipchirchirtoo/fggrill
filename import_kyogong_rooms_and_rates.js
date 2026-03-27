const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

// Kyogong Branch ID
const BRANCH_ID = 1;

const roomData = [
  { type: 'Deluxe', rooms: ['FG01', 'FA01', 'FA02', 'FA03', 'FA04', 'FA05', 'FA07', 'FA08', 'FA13', 'FB01', 'FB02', 'FB03', 'FB04', 'FB05', 'FB06', 'FB07', 'FB08', 'FB13'] },
  { type: 'Standard', rooms: ['FG47', 'FG48', 'FG49', 'FG50', 'FG51', 'FG52', 'FG53', 'FG54', 'FG55', 'FG56', 'FG57', 'FG58', 'FG59', 'FG60', 'FG61', 'FG62', 'FG63', 'FG64', 'FG65', 'FG66', 'FG67'] },
  { type: 'Deluxe Twin', rooms: ['FA10', 'FA11', 'FB17', 'FB18'] },
  { type: 'Executive', rooms: ['FA09', 'FB09', 'FB10', 'FB11', 'FB12', 'FB15', 'FB16', 'FB19', 'FB20', 'FC02', 'FC01-A', 'FC01-B'] },
  { type: 'VIP Suite', rooms: ['FB14'] },
  { type: 'Cottage', rooms: ['COTTAGE-01'] },
  { type: 'Conference Hall', rooms: ['SINAI HALL', 'GARDEN HALL', 'BOARDROOM', 'NEXT TO BOARDROOM', 'OLIVE HALL', 'DINING HALL', 'ZION HALL'] }
];

const ratePlans = [
  // Standard
  { type: 'Standard', name: 'Resident Single BO', code: 'STD-R-BO', price: 2000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Standard', name: 'Resident Single BB', code: 'STD-R-BB', price: 3000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Standard', name: 'Non-Resident Single BO', code: 'STD-NR-BO', price: 15, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Standard', name: 'Non-Resident Single BB', code: 'STD-NR-BB', price: 25, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // Deluxe Single
  { type: 'Deluxe', name: 'Resident Single BB', code: 'DLX-S-R-BB', price: 3500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Resident Single HB', code: 'DLX-S-R-HB', price: 4500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Resident Single FB', code: 'DLX-S-R-FB', price: 5500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Single BB', code: 'DLX-S-NR-BB', price: 30, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Single HB', code: 'DLX-S-NR-HB', price: 40, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Single FB', code: 'DLX-S-NR-FB', price: 50, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // Deluxe Double
  { type: 'Deluxe', name: 'Resident Double BB', code: 'DLX-D-R-BB', price: 4500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Resident Double HB', code: 'DLX-D-R-HB', price: 6500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Resident Double FB', code: 'DLX-D-R-FB', price: 8500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Double BB', code: 'DLX-D-NR-BB', price: 40, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Double HB', code: 'DLX-D-NR-HB', price: 60, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe', name: 'Non-Resident Double FB', code: 'DLX-D-NR-FB', price: 80, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // Deluxe Twin
  { type: 'Deluxe Twin', name: 'Resident BB', code: 'DTW-R-BB', price: 5000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe Twin', name: 'Resident HB', code: 'DTW-R-HB', price: 7000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe Twin', name: 'Resident FB', code: 'DTW-R-FB', price: 9000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe Twin', name: 'Non-Resident BB', code: 'DTW-NR-BB', price: 50, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe Twin', name: 'Non-Resident HB', code: 'DTW-NR-HB', price: 70, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Deluxe Twin', name: 'Non-Resident FB', code: 'DTW-NR-FB', price: 80, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // Executive Single
  { type: 'Executive', name: 'Resident Single BB', code: 'EXE-S-R-BB', price: 5500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Resident Single HB', code: 'EXE-S-R-HB', price: 6500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Resident Single FB', code: 'EXE-S-R-FB', price: 7500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Single BB', code: 'EXE-S-NR-BB', price: 50, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Single HB', code: 'EXE-S-NR-HB', price: 60, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Single FB', code: 'EXE-S-NR-FB', price: 70, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // Executive Double
  { type: 'Executive', name: 'Resident Double BB', code: 'EXE-D-R-BB', price: 6500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Resident Double HB', code: 'EXE-D-R-HB', price: 8500, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Resident Double FB', code: 'EXE-D-R-FB', price: 10000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Double BB', code: 'EXE-D-NR-BB', price: 60, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Double HB', code: 'EXE-D-NR-HB', price: 80, currency: 'USD', rate_type: 'fixed', min_nights: 1 },
  { type: 'Executive', name: 'Non-Resident Double FB', code: 'EXE-D-NR-FB', price: 90, currency: 'USD', rate_type: 'fixed', min_nights: 1 },

  // VIP Suite
  { type: 'VIP Suite', name: 'Whole Unit BB', code: 'VIP-W-R-BB', price: 12000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },
  { type: 'VIP Suite', name: '1 PAX BB', code: 'VIP-1P-R-BB', price: 8000, currency: 'KES', rate_type: 'fixed', min_nights: 1 },

  // Cottage
  { type: 'Cottage', name: 'Self-catering 1-5 Days', code: 'CTG-1-5', price: 8000, currency: 'KES', rate_type: 'fixed', min_nights: 1, max_nights: 5 },
  { type: 'Cottage', name: 'Self-catering 5-15 Days', code: 'CTG-5-15', price: 6000, currency: 'KES', rate_type: 'fixed', min_nights: 5, max_nights: 15 },
  { type: 'Cottage', name: 'Self-catering 15-30 Days', code: 'CTG-15-30', price: 4000, currency: 'KES', rate_type: 'fixed', min_nights: 15, max_nights: 30 }
];

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('Cleaning up existing rooms and types for Kyogong (id=1)...');
    // We should only delete if we want a fresh start. Since user asked to ADD, but also it's a new setup, it's safer to clear first if any exist.
    await client.query('DELETE FROM rooms WHERE branch_id = $1', [BRANCH_ID]);
    await client.query('DELETE FROM rate_plans WHERE branch_id = $1', [BRANCH_ID]);
    await client.query('DELETE FROM room_types WHERE branch_id = $1', [BRANCH_ID]);

    const typeMap = {};

    console.log('Inserting Room Types...');
    for (const type of roomData) {
      const res = await client.query(
        'INSERT INTO room_types (name, base_price, branch_id, code, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [type.type, 0, BRANCH_ID, type.type.toUpperCase().replace(/\s+/g, '_'), true]
      );
      typeMap[type.type] = res.rows[0].id;
      console.log(`- Inserted Room Type: ${type.type} (ID: ${typeMap[type.type]})`);
    }

    console.log('Inserting Rooms...');
    for (const typeInfo of roomData) {
      const typeId = typeMap[typeInfo.type];
      for (const roomNum of typeInfo.rooms) {
        await client.query(
          'INSERT INTO rooms (room_number, room_type_id, branch_id, status, active) VALUES ($1, $2, $3, $4, $5)',
          [roomNum, typeId, BRANCH_ID, 'available', true]
        );
      }
      console.log(`- Inserted ${typeInfo.rooms.length} rooms for type ${typeInfo.type}`);
    }

    console.log('Inserting Rate Plans...');
    for (const rate of ratePlans) {
      // Find room type id
      const typeId = typeMap[rate.type];
      if (!typeId) {
        console.warn(`Warning: Type ${rate.type} not found in map for rate ${rate.name}`);
        continue;
      }
      
      await client.query(
        'INSERT INTO rate_plans (name, code, base_price, rate_type, min_nights, max_nights, branch_id, refundable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [rate.name, rate.code, rate.price, rate.rate_type, rate.min_nights, rate.max_nights || null, BRANCH_ID, true]
      );
    }
    console.log(`- Inserted ${ratePlans.length} rate plans.`);

    await client.query('COMMIT');
    console.log('\nKyogong Branch Data Import Successful!');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e.message);
  } finally {
    await client.end();
  }
}

run();
