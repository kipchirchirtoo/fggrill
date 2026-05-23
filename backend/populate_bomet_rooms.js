const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const roomsData = [
  { roomNumber: 'Room 13', typeName: 'Standard', price: 1000, floor: 1 },
  { roomNumber: 'Room 14', typeName: 'Standard', price: 1000, floor: 1 },
  { roomNumber: 'Room 15', typeName: 'Standard', price: 1000, floor: 1 },
  { roomNumber: 'Room 16', typeName: 'Standard', price: 1000, floor: 1 },
  { roomNumber: 'Room 17', typeName: 'Standard', price: 700, floor: 1 },
  { roomNumber: 'Room 18', typeName: 'Standard', price: 700, floor: 1 }
];

async function run() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' 
  });
  
  await client.connect();

  try {
    await client.query('BEGIN');
    
    // Find Bomet Town branch
    let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%BOMET%'");
    let branchId;
    
    if (branchRes.rows.length === 0) {
      console.log('Bomet Town branch not found.');
      return;
    } else {
      branchId = branchRes.rows[0].id;
      console.log(`Found Bomet Town branch with ID: ${branchId}`);
    }

    // Get Standard room type ID
    const typeRes = await client.query("SELECT id FROM room_types WHERE name = 'Standard'");
    if (typeRes.rows.length === 0) {
      console.log('Standard room type not found.');
      return;
    }
    const typeId = typeRes.rows[0].id;
    console.log(`Found Standard room type with ID: ${typeId}`);

    // Insert rooms
    let insertedRooms = 0;
    let skippedRooms = 0;

    for (const room of roomsData) {
      // Check if room already exists
      const existingRes = await client.query(
        "SELECT id FROM rooms WHERE room_number = $1 AND branch_id = $2",
        [room.roomNumber, branchId]
      );

      if (existingRes.rows.length > 0) {
        console.log(`Skipping existing room: ${room.roomNumber}`);
        skippedRooms++;
        continue;
      }

      const roomId = uuidv4();
      await client.query(
        `INSERT INTO rooms (id, room_number, room_type_id, type_id, floor, status, branch_id, room_type, price_override, active, is_clean, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          roomId,
          room.roomNumber,
          typeId,
          typeId,
          room.floor,
          'available',
          branchId,
          room.typeName,
          room.price,
          true,
          true
        ]
      );

      insertedRooms++;
      console.log(`Inserted room: ${room.roomNumber} (${room.typeName}) - KES ${room.price}`);
    }

    await client.query('COMMIT');
    console.log(`\n=== SUMMARY ===`);
    console.log(`Branch ID: ${branchId}`);
    console.log(`Rooms - Inserted: ${insertedRooms}, Skipped: ${skippedRooms}`);
    console.log(`Total rooms: ${roomsData.length}`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run();
