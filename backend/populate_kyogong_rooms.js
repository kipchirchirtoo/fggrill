const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const roomData = {
  roomTypes: [
    {
      name: 'Standard',
      code: 'STD',
      description: 'Standard room',
      basePrice: 3000,
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      bedType: 'Double',
      sizeSqm: 25
    },
    {
      name: 'Deluxe',
      code: 'DLX',
      description: 'Deluxe room',
      basePrice: 4500,
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      bedType: 'Double',
      sizeSqm: 30
    },
    {
      name: 'Deluxe Twin',
      code: 'DLT',
      description: 'Deluxe twin room with 2 separate beds',
      basePrice: 5000,
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      bedType: 'Twin',
      sizeSqm: 32
    },
    {
      name: 'Executive',
      code: 'EXE',
      description: 'Executive room',
      basePrice: 6500,
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      bedType: 'Double',
      sizeSqm: 40
    },
    {
      name: 'Conference Hall',
      code: 'CONF',
      description: 'Conference hall',
      basePrice: 15000,
      maxOccupancy: 50,
      maxAdults: 50,
      maxChildren: 0,
      bedType: 'None',
      sizeSqm: 100
    }
  ],
  rooms: [
    // Deluxe
    { roomNumber: 'FG 01', typeName: 'Deluxe', building: 'FG', floor: 1 },
    { roomNumber: 'FG 47', typeName: 'Deluxe', building: 'FG', floor: 4 },
    
    // Standard
    { roomNumber: 'FG 48', typeName: 'Standard', building: 'FG', floor: 4 },
    { roomNumber: 'FG 49', typeName: 'Standard', building: 'FG', floor: 4 },
    { roomNumber: 'FG 50', typeName: 'Standard', building: 'FG', floor: 4 },
    { roomNumber: 'FG 51', typeName: 'Standard', building: 'FG', floor: 4 },
    { roomNumber: 'FG 52', typeName: 'Standard', building: 'FG', floor: 4 },
    { roomNumber: 'FG 53', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Conference' },
    { roomNumber: 'FG 54', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Sinai Hall' },
    { roomNumber: 'FG 55', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Garden Hall' },
    { roomNumber: 'FG 56', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Boardroom' },
    { roomNumber: 'FG 57', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Next to boardroom' },
    { roomNumber: 'FG 58', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Olive Hall' },
    { roomNumber: 'FG 59', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Dining Hall' },
    { roomNumber: 'FG 60', typeName: 'Conference Hall', building: 'FG', floor: 5, notes: 'Zion Hall' },
    { roomNumber: 'FG 61', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 62', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 63', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 64', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 65', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 66', typeName: 'Standard', building: 'FG', floor: 6 },
    { roomNumber: 'FG 67', typeName: 'Standard', building: 'FG', floor: 6 },
    
    // Deluxe Twin
    { roomNumber: 'FA 10', typeName: 'Deluxe Twin', building: 'FA', floor: 1 },
    { roomNumber: 'FA 11', typeName: 'Deluxe Twin', building: 'FA', floor: 1 },
    
    // Executive
    { roomNumber: 'FA 09', typeName: 'Executive', building: 'FA', floor: 1 },
    { roomNumber: 'FB 09', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 10', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 11', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 12', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 14', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 15', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 16', typeName: 'Executive', building: 'FB', floor: 1 },
    { roomNumber: 'FB 19', typeName: 'Executive', building: 'FB', floor: 2 },
    { roomNumber: 'FB 20', typeName: 'Executive', building: 'FB', floor: 2 },
    { roomNumber: 'FC 01-A', typeName: 'Executive', building: 'FC', floor: 1 },
    { roomNumber: 'FC 01-B', typeName: 'Executive', building: 'FC', floor: 1 },
    { roomNumber: 'FC 02', typeName: 'Executive', building: 'FC', floor: 1 },
    
    // Other FA rooms
    { roomNumber: 'FA 01', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 02', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 03', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 04', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 05', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 06', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 07', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 08', typeName: 'Standard', building: 'FA', floor: 1 },
    { roomNumber: 'FA 13', typeName: 'Standard', building: 'FA', floor: 1 },
    
    // Other FB rooms
    { roomNumber: 'FB 01', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 02', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 03', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 04', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 05', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 06', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 07', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 08', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 13', typeName: 'Standard', building: 'FB', floor: 1 },
    { roomNumber: 'FB 17', typeName: 'Standard', building: 'FB', floor: 1, notes: 'Complimentary' },
    { roomNumber: 'FB 18', typeName: 'Standard', building: 'FB', floor: 2 }
  ]
};

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
      console.log('Kyogong branch not found. Creating it...');
      const iRes = await client.query(
        "INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
        ['KYOGONG BRANCH', 'KYO', 'Kyogong', false, 'active']
      );
      branchId = iRes.rows[0].id;
    } else {
      branchId = branchRes.rows[0].id;
      console.log(`Found Kyogong branch with ID: ${branchId}`);
    }

    // Insert room types
    const roomTypeMap = new Map();
    let insertedTypes = 0;
    let skippedTypes = 0;

    for (const type of roomData.roomTypes) {
      // Check if room type already exists
      const existingRes = await client.query(
        "SELECT id FROM room_types WHERE code = $1 OR name = $2",
        [type.code, type.name]
      );

      if (existingRes.rows.length > 0) {
        roomTypeMap.set(type.name, existingRes.rows[0].id);
        console.log(`Skipping existing room type: ${type.name}`);
        skippedTypes++;
        continue;
      }

      const typeId = uuidv4();
      await client.query(
        `INSERT INTO room_types (id, name, code, description, base_price, max_occupancy, max_adults, max_children, size_sqm, bed_type, active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          typeId,
          type.name,
          type.code,
          type.description,
          type.basePrice,
          type.maxOccupancy,
          type.maxAdults,
          type.maxChildren,
          type.sizeSqm,
          type.bedType,
          true
        ]
      );

      roomTypeMap.set(type.name, typeId);
      insertedTypes++;
      console.log(`Inserted room type: ${type.name}`);
    }

    // Insert rooms
    let insertedRooms = 0;
    let skippedRooms = 0;

    for (const room of roomData.rooms) {
      const typeId = roomTypeMap.get(room.typeName);
      if (!typeId) {
        console.error(`Room type not found: ${room.typeName}`);
        continue;
      }

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
        `INSERT INTO rooms (id, room_number, room_type_id, type_id, floor, status, branch_id, room_type, building, active, is_clean, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          roomId,
          room.roomNumber,
          typeId,
          typeId,
          room.floor || 1,
          room.isHall ? 'available' : 'available',
          branchId,
          room.typeName,
          room.building,
          true,
          true,
          room.notes || null
        ]
      );

      insertedRooms++;
      console.log(`Inserted room: ${room.roomNumber} (${room.typeName})`);
    }

    await client.query('COMMIT');
    console.log(`\n=== SUMMARY ===`);
    console.log(`Branch ID: ${branchId}`);
    console.log(`Room Types - Inserted: ${insertedTypes}, Skipped: ${skippedTypes}`);
    console.log(`Rooms - Inserted: ${insertedRooms}, Skipped: ${skippedRooms}`);
    console.log(`Total room types: ${roomData.roomTypes.length}`);
    console.log(`Total rooms: ${roomData.rooms.length}`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run();
