const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const hallsData = [
  { roomNumber: 'FG 53', name: 'Conference', capacity: 50, basePricePerDay: 15000, basePricePerHour: 2000 },
  { roomNumber: 'FG 54', name: 'Sinai Hall', capacity: 50, basePricePerDay: 15000, basePricePerHour: 2000 },
  { roomNumber: 'FG 55', name: 'Garden Hall', capacity: 50, basePricePerDay: 15000, basePricePerHour: 2000 },
  { roomNumber: 'FG 56', name: 'Boardroom', capacity: 20, basePricePerDay: 12000, basePricePerHour: 1500 },
  { roomNumber: 'FG 57', name: 'Next to Boardroom', capacity: 20, basePricePerDay: 12000, basePricePerHour: 1500 },
  { roomNumber: 'FG 58', name: 'Olive Hall', capacity: 50, basePricePerDay: 15000, basePricePerHour: 2000 },
  { roomNumber: 'FG 59', name: 'Dining Hall', capacity: 100, basePricePerDay: 20000, basePricePerHour: 3000 },
  { roomNumber: 'FG 60', name: 'Zion Hall', capacity: 50, basePricePerDay: 15000, basePricePerHour: 2000 }
];

async function run() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' 
  });
  
  await client.connect();

  try {
    await client.query('BEGIN');
    
    // Find Kyogong branch
    let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%KYOGONG%'");
    let branchId;
    
    if (branchRes.rows.length === 0) {
      console.log('Kyogong branch not found.');
      return;
    } else {
      branchId = branchRes.rows[0].id;
      console.log(`Found Kyogong branch with ID: ${branchId}`);
    }

    let insertedHalls = 0;
    let deletedRooms = 0;

    for (const hall of hallsData) {
      // Check if conference hall already exists
      const existingRes = await client.query(
        "SELECT id FROM conference_halls WHERE name = $1 AND branch_id = $2",
        [hall.name, branchId]
      );

      if (existingRes.rows.length > 0) {
        console.log(`Skipping existing conference hall: ${hall.name}`);
        continue;
      }

      // Insert into conference_halls
      const hallId = uuidv4();
      await client.query(
        `INSERT INTO conference_halls (id, branch_id, name, capacity, base_price_per_day, base_price_per_hour, status, description, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          hallId,
          branchId,
          hall.name,
          hall.capacity,
          hall.basePricePerDay,
          hall.basePricePerHour,
          'available',
          `Conference hall - ${hall.name}`
        ]
      );

      insertedHalls++;
      console.log(`Inserted conference hall: ${hall.name}`);

      // Delete from rooms table
      const deleteRes = await client.query(
        "DELETE FROM rooms WHERE room_number = $1 AND branch_id = $2",
        [hall.roomNumber, branchId]
      );

      if (deleteRes.rowCount > 0) {
        deletedRooms++;
        console.log(`Deleted room: ${hall.roomNumber} from rooms table`);
      }
    }

    await client.query('COMMIT');
    console.log(`\n=== SUMMARY ===`);
    console.log(`Branch ID: ${branchId}`);
    console.log(`Conference Halls Inserted: ${insertedHalls}`);
    console.log(`Rooms Deleted: ${deletedRooms}`);
    console.log(`Total halls processed: ${hallsData.length}`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run();
