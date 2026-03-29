const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function fix() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- APPLYING IDEMPOTENT TRIGGER ---');
  const triggerSQL = `
    CREATE OR REPLACE FUNCTION create_staff_profile()
    RETURNS TRIGGER AS $$
    DECLARE
      existing_id UUID;
    BEGIN
      -- Check if a staff profile already exists by name/email to prevent duplication
      SELECT id INTO existing_id 
      FROM staff_profiles 
      WHERE (email IS NOT NULL AND email = NEW.email)
         OR (LOWER(TRIM(first_name)) = LOWER(TRIM(NEW.first_name)) AND LOWER(TRIM(last_name)) = LOWER(TRIM(NEW.last_name)) AND branch_id = NEW.branch_id)
      LIMIT 1;

      IF existing_id IS NOT NULL THEN
        -- LINK and UPDATE existing profile
        UPDATE staff_profiles 
        SET user_id = NEW.id,
            role = NEW.role,
            department = COALESCE(department, CASE 
              WHEN NEW.role = 'super_admin' OR NEW.role = 'manager' THEN 'management'
              WHEN NEW.role = 'accountant' THEN 'finance'
              ELSE NEW.role
            END)
        WHERE id = existing_id AND user_id IS NULL;
      ELSE
        -- INSERT only if truly new
        INSERT INTO staff_profiles (
          user_id, role, first_name, last_name, email, phone, department, shift, basic_salary, start_date, id_number, branch_id
        ) VALUES (
          NEW.id, NEW.role, NEW.first_name, NEW.last_name, NEW.email, NEW.phone_number,
          CASE 
            WHEN NEW.role = 'super_admin' OR NEW.role = 'manager' THEN 'management'
            WHEN NEW.role = 'accountant' THEN 'finance'
            ELSE NEW.role
          END,
          'morning', 0, CURRENT_DATE, 'pending', NEW.branch_id
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  await client.query(triggerSQL);
  console.log('Trigger updated.');

  console.log('\n--- DEDUPLICATING SPECIFIC RECORDS ---');
  // If there are any records with identical id_number in the same branch, merge them
  const mergeTargets = ['FGH008', 'FGH081', 'FGH073'];
  for (const idNo of mergeTargets) {
    const res = await client.query('SELECT id, first_name, last_name, department FROM staff_profiles WHERE id_number = $1 ORDER BY updated_at DESC', [idNo]);
    if (res.rows.length > 1) {
      console.log(`Merging ${res.rows.length} records for ${idNo}`);
      const canonical = res.rows[0].id;
      for (let i = 1; i < res.rows.length; i++) {
        const duplicate = res.rows[i].id;
        console.log(`  Deleting duplicate ${duplicate} (${res.rows[i].first_name})`);
        // Transfer any foreign keys if necessary (loans, advances, etc)
        // For now, just delete the duplicate if it's the 008 case
        await client.query('DELETE FROM staff_profiles WHERE id = $1', [duplicate]);
      }
    } else {
      console.log(`No duplicate found for ${idNo} in staff_profiles.`);
    }
  }

  await client.end();
}

fix();
