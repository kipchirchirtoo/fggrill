
const { Client } = require('pg');

const OLD_DB = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';
const NEW_DB = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function migrate() {
  const oldClient = new Client({ connectionString: OLD_DB });
  const newClient = new Client({ connectionString: NEW_DB });

  await oldClient.connect();
  await newClient.connect();

  console.log('=== DROPPING and RECREATING staff_profiles in new DB ===');

  // 1. Drop dependent objects first
  await newClient.query('DROP TABLE IF EXISTS public.staff_profiles CASCADE');
  console.log('Dropped old staff_profiles table');

  // 2. Create table matching old DB schema EXACTLY
  // BUT: id_number renamed to employee_number
  await newClient.query(`
    CREATE TABLE public.staff_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      shift TEXT NOT NULL DEFAULT 'morning',
      basic_salary NUMERIC NOT NULL DEFAULT 0,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      employee_number TEXT NOT NULL,
      emergency_contact TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMPTZ,
      branch_id INTEGER,
      national_id TEXT,
      rfid_tag TEXT,
      rest_day INTEGER DEFAULT 0,
      hourly_base_rate NUMERIC DEFAULT 0,
      kra_pin TEXT,
      nssf_number TEXT,
      nhif_number TEXT,
      shif_number TEXT,
      bank_name TEXT,
      bank_branch TEXT,
      account_number TEXT,
      mpesa_number TEXT,
      employment_type TEXT DEFAULT 'permanent',
      contract_expiry DATE,
      next_of_kin_name TEXT,
      next_of_kin_phone TEXT,
      next_of_kin_relationship TEXT,
      supervisor_id UUID,
      archive_notes TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      position TEXT,
      nssf_enabled BOOLEAN DEFAULT true,
      shif_enabled BOOLEAN DEFAULT true,
      housing_fund_enabled BOOLEAN DEFAULT true,
      uniform_enabled BOOLEAN DEFAULT false,
      profile_photo TEXT
    )
  `);
  console.log('Created new staff_profiles table matching old DB schema (id_number renamed to employee_number)');

  // 3. Fetch all staff from old DB
  console.log('Fetching staff from old DB...');
  const { rows: oldStaff } = await oldClient.query('SELECT * FROM public.staff_profiles ORDER BY id');
  console.log('Fetched ' + oldStaff.length + ' staff records from old DB.');

  // 4. Insert all records into new DB
  console.log('Inserting into new DB...');
  let inserted = 0, errors = 0;

  for (const s of oldStaff) {
    try {
      await newClient.query(`
        INSERT INTO public.staff_profiles (
          id, user_id, role, department, shift, basic_salary, start_date,
          employee_number, emergency_contact, address, status, created_at,
          updated_at, branch_id, national_id, rfid_tag, rest_day, hourly_base_rate,
          kra_pin, nssf_number, nhif_number, shif_number, bank_name, bank_branch,
          account_number, mpesa_number, employment_type, contract_expiry,
          next_of_kin_name, next_of_kin_phone, next_of_kin_relationship,
          supervisor_id, archive_notes, first_name, last_name, email, phone,
          position, nssf_enabled, shif_enabled, housing_fund_enabled,
          uniform_enabled, profile_photo
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43
        )
      `, [
        s.id, s.user_id, s.role, s.department, s.shift, s.basic_salary, s.start_date,
        s.id_number,
        s.emergency_contact, s.address, s.status, s.created_at, s.updated_at,
        s.branch_id, s.national_id, s.rfid_tag, s.rest_day, s.hourly_base_rate,
        s.kra_pin, s.nssf_number, s.nhif_number, s.shif_number, s.bank_name, s.bank_branch,
        s.account_number, s.mpesa_number, s.employment_type, s.contract_expiry,
        s.next_of_kin_name, s.next_of_kin_phone, s.next_of_kin_relationship,
        s.supervisor_id, s.archive_notes, s.first_name, s.last_name, s.email, s.phone,
        s.position, s.nssf_enabled, s.shif_enabled, s.housing_fund_enabled,
        s.uniform_enabled, s.profile_photo
      ]);
      inserted++;
    } catch (err) {
      console.error('Error inserting ' + s.id + ' (' + s.first_name + ' ' + s.last_name + '): ' + err.message);
      errors++;
    }
  }

  console.log('\nMigration complete:');
  console.log('  Inserted: ' + inserted);
  console.log('  Errors: ' + errors);

  // 5. Add indexes
  await newClient.query('CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch ON public.staff_profiles(branch_id)');
  await newClient.query('CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON public.staff_profiles(status)');
  await newClient.query('CREATE INDEX IF NOT EXISTS idx_staff_profiles_employee_number ON public.staff_profiles(employee_number)');
  await newClient.query('CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON public.staff_profiles(department)');
  console.log('\nIndexes created.');

  // 6. Verify
  const { rows: verify } = await newClient.query(`
    SELECT COUNT(*) as total, COUNT(employee_number) as with_emp_num, COUNT(national_id) as with_nat_id
    FROM public.staff_profiles
  `);
  console.log('\nVerification:');
  console.log('  Total staff: ' + verify[0].total);
  console.log('  With employee_number: ' + verify[0].with_emp_num);
  console.log('  With national_id: ' + verify[0].with_nat_id);

  const { rows: sample } = await newClient.query(`
    SELECT first_name, last_name, employee_number, national_id, department, position
    FROM public.staff_profiles LIMIT 5
  `);
  console.log('\nSample records:');
  sample.forEach(s => console.log('  ' + s.first_name + ' ' + s.last_name + ': emp=' + s.employee_number + ', nat_id=' + s.national_id + ', dept=' + s.department + ', pos=' + s.position));

  // 7. Show columns
  const { rows: cols } = await newClient.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'staff_profiles' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('\nNew DB staff_profiles columns:');
  cols.forEach(c => console.log('  ' + c.column_name + ': ' + c.data_type));

  await oldClient.end();
  await newClient.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
