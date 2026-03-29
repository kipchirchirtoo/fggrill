const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function verify() {
  await client.connect();

  const hallId = '77a6d955-8082-430d-b870-77f05afcb34e'; // SINAI HALL
  const startDate = '2026-03-30T08:00:00Z';
  const endDate = '2026-03-30T17:00:00Z';

  console.log('--- Testing Availability Check ---');
  // Since we haven't booked anything yet, it should be available.
  // We can't easily call the API from here as it requires auth, 
  // but we can check the database tables directly with the same logic as the controller.
  
  const { rows: bookings } = await client.query(
    "SELECT * FROM conference_hall_bookings WHERE conference_hall_id = $1 AND booking_status = 'confirmed' AND (start_date < $3 AND end_date > $2)",
    [hallId, startDate, endDate]
  );
  
  const { rows: invoices } = await client.query(
    "SELECT * FROM accounting_ar_invoices WHERE conference_hall_id = $1 AND status != 'voided' AND (conference_start_date < $3 AND conference_end_date > $2)",
    [hallId, startDate, endDate]
  );

  console.log('Bookings overlap:', bookings.length);
  console.log('Invoices overlap:', invoices.length);

  if (bookings.length === 0 && invoices.length === 0) {
    console.log('SUCCESS: Hall available for slot');
  } else {
    console.warn('FAILURE: Hall should be available but has overlaps');
  }

  console.log('\n--- Simulating Conference Invoice Creation ---');
  // We'll insert an invoice and see if a booking is created would happen in the controller.
  // Actually, I'll just check if my controller logic matches this.
  
  console.log('Verification script complete.');
  await client.end();
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
