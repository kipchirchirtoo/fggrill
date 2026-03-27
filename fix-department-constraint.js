const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});

const sql = `
ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS valid_department;
ALTER TABLE staff_profiles ADD CONSTRAINT valid_department CHECK (department IN (
  'housekeeping',
  'restaurant',
  'reception',
  'maintenance',
  'finance',
  'management',
  'security',
  'bar_lounge',
  'administration',
  'driver',
  'logistics',
  'stores',
  'laundry',
  'it',
  'kitchen',
  'general',
  'procurement',
  'accounts',
  'human_resources',
  'operations'
));
`;

client.connect()
  .then(() => {
    console.log('Connected. Applying migration...');
    return client.query(sql);
  })
  .then(r => {
    console.log('SUCCESS! Constraint updated.');
    return client.end();
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    return client.end();
  });
