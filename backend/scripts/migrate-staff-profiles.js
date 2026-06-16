
const { Client } = require('pg');

const OLD_DB = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';
const NEW_DB = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function migrate() {
  const oldClient = new Client({ connectionString: OLD_DB });
  const newClient = new Client({ connectionString: NEW_DB });

  await oldClient.connect();
  await newClient.connect();

  // 1. Add missing columns
  console.log('Adding missing columns to new DB...');
  const columns = [
    'emergency_contact TEXT',
    'address TEXT',
    'kra_pin TEXT',
    'nssf_number TEXT',
    'nhif_number TEXT',
    'shif_number TEXT',
    'mpesa_number TEXT',
    'contract_expiry DATE',
    'next_of_kin_name TEXT',
    'next_of_kin_phone TEXT',
    'next_of_kin_relationship TEXT',
    'supervisor_id UUID',
    'archive_notes TEXT',
    'rest_day INTEGER DEFAULT 0',
    'hourly_base_rate NUMERIC DEFAULT 0'
  ];
  for (const col of columns) {
    await newClient.query('ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS ' + col);
  }
  console.log('Columns added.');

  // 2. Fetch all staff from old DB
  console.log('Fetching staff from old DB...');
  const { rows: oldStaff } = await oldClient.query('SELECT * FROM public.staff_profiles ORDER BY id');
  console.log('Fetched ' + oldStaff.length + ' staff records from old DB.');

  // 3. Update each record
  console.log('Updating new DB staff_profiles...');
  let updated = 0, errors = 0;

  for (const s of oldStaff) {
    try {
      const { rows: existing } = await newClient.query(
        'SELECT id FROM public.staff_profiles WHERE id = $1',
        [s.id]
      );

      if (existing.length > 0) {
        const updateSql = `
          UPDATE public.staff_profiles SET
            employee_number = COALESCE($2, employee_number),
            id_number = COALESCE($3, id_number),
            first_name = COALESCE($4, first_name),
            last_name = COALESCE($5, last_name),
            email = COALESCE(NULLIF($6, ''), email),
            phone = COALESCE($7, phone),
            role = COALESCE($8, role),
            department = COALESCE($9, department),
            position = COALESCE($10, position),
            shift = COALESCE($11, shift),
            basic_salary = COALESCE($12, basic_salary),
            start_date = COALESCE($13::date, start_date),
            hire_date = COALESCE($13::date, hire_date),
            status = COALESCE($14, status),
            employment_status = COALESCE($14, employment_status),
            branch_id = COALESCE($15, branch_id),
            national_id = COALESCE($16, national_id),
            rfid_tag = COALESCE($17, rfid_tag),
            bank_name = COALESCE($18, bank_name),
            bank_branch = COALESCE($19, bank_branch),
            account_number = COALESCE($20, account_number),
            profile_photo = COALESCE($21, profile_photo),
            profile_photo_url = COALESCE($21, profile_photo_url),
            employment_type = COALESCE($22, employment_type),
            nssf_enabled = COALESCE($23, nssf_enabled),
            shif_enabled = COALESCE($24, shif_enabled),
            housing_fund_enabled = COALESCE($25, housing_fund_enabled),
            uniform_enabled = COALESCE($26, uniform_enabled),
            emergency_contact = COALESCE($27, emergency_contact),
            address = COALESCE($28, address),
            kra_pin = COALESCE($29, kra_pin),
            nssf_number = COALESCE($30, nssf_number),
            nhif_number = COALESCE($31, nhif_number),
            shif_number = COALESCE($32, shif_number),
            mpesa_number = COALESCE($33, mpesa_number),
            contract_expiry = COALESCE($34::date, contract_expiry),
            next_of_kin_name = COALESCE($35, next_of_kin_name),
            next_of_kin_phone = COALESCE($36, next_of_kin_phone),
            next_of_kin_relationship = COALESCE($37, next_of_kin_relationship),
            supervisor_id = COALESCE($38, supervisor_id),
            archive_notes = COALESCE($39, archive_notes),
            rest_day = COALESCE($40, rest_day),
            hourly_base_rate = COALESCE($41, hourly_base_rate),
            updated_at = NOW()
          WHERE id = $1
        `;
        await newClient.query(updateSql, [
          s.id, s.id_number, s.id_number, s.first_name, s.last_name, s.email, s.phone,
          s.role, s.department, s.position, s.shift, s.basic_salary, s.start_date,
          s.status, s.branch_id, s.national_id, s.rfid_tag, s.bank_name, s.bank_branch,
          s.account_number, s.profile_photo, s.employment_type, s.nssf_enabled,
          s.shif_enabled, s.housing_fund_enabled, s.uniform_enabled, s.emergency_contact,
          s.address, s.kra_pin, s.nssf_number, s.nhif_number, s.shif_number, s.mpesa_number,
          s.contract_expiry, s.next_of_kin_name, s.next_of_kin_phone, s.next_of_kin_relationship,
          s.supervisor_id, s.archive_notes, s.rest_day, s.hourly_base_rate
        ]);
        updated++;
      } else {
        await newClient.query(`
          INSERT INTO public.staff_profiles (
            id, user_id, branch_id, employee_number, first_name, last_name, national_id,
            phone, email, job_title, employment_status, hire_date, created_at, updated_at,
            role, basic_salary, bank_name, account_number, profile_photo_url, rfid_tag,
            pos_pin, nssf_enabled, shif_enabled, uniform_enabled, housing_fund_enabled,
            department, position, status, start_date, id_number, shift, employment_type,
            bank_branch, profile_photo, emergency_contact, address, kra_pin, nssf_number,
            nhif_number, shif_number, mpesa_number, contract_expiry, next_of_kin_name,
            next_of_kin_phone, next_of_kin_relationship, supervisor_id, archive_notes,
            rest_day, hourly_base_rate
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(),
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
            $40, $41, $42, $43, $44, $45, $46, $47
          )
        `, [
          s.id, s.user_id, s.branch_id, s.id_number, s.first_name, s.last_name, s.national_id,
          s.phone, s.email, s.position, s.status, s.start_date, s.created_at, s.role,
          s.basic_salary, s.bank_name, s.account_number, s.profile_photo, s.rfid_tag, null,
          s.nssf_enabled, s.shif_enabled, s.uniform_enabled, s.housing_fund_enabled,
          s.department, s.position, s.status, s.start_date, s.id_number, s.shift,
          s.employment_type, s.bank_branch, s.profile_photo, s.emergency_contact, s.address,
          s.kra_pin, s.nssf_number, s.nhif_number, s.shif_number, s.mpesa_number,
          s.contract_expiry, s.next_of_kin_name, s.next_of_kin_phone, s.next_of_kin_relationship,
          s.supervisor_id, s.archive_notes, s.rest_day, s.hourly_base_rate
        ]);
      }
    } catch (err) {
      console.error('Error processing ' + s.id + ' (' + s.first_name + ' ' + s.last_name + '): ' + err.message);
      errors++;
    }
  }

  console.log('\nMigration complete:');
  console.log('  Updated: ' + updated);
  console.log('  Errors: ' + errors);

  const { rows: verify } = await newClient.query("SELECT COUNT(*) as count, COUNT(employee_number) as with_emp_num, COUNT(id_number) as with_id_num FROM public.staff_profiles");
  console.log('\nNew DB verification:');
  console.log('  Total staff: ' + verify[0].count);
  console.log('  With employee_number: ' + verify[0].with_emp_num);
  console.log('  With id_number: ' + verify[0].with_id_num);

  const { rows: sample } = await newClient.query("SELECT first_name, last_name, employee_number, id_number, department, position FROM public.staff_profiles WHERE employee_number IS NOT NULL LIMIT 5");
  console.log('\nSample records with employee_number:');
  sample.forEach(s => console.log('  ' + s.first_name + ' ' + s.last_name + ': emp=' + s.employee_number + ', id=' + s.id_number + ', dept=' + s.department + ', pos=' + s.position));

  await oldClient.end();
  await newClient.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
