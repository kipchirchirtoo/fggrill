require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB');

  console.log('Terminating locks on pos_shift_orders...');
  await client.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE pid <> pg_backend_pid()
      AND query LIKE '%pos_shift_orders%';
  `);

  console.log('Altering pos_shift_orders...');
  await client.query(`
    ALTER TABLE public.pos_shift_orders
      ADD COLUMN IF NOT EXISTS master_bill_id  uuid,
      ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';
  `);
  console.log('ALTER TABLE pos_shift_orders SUCCESS!');

  console.log('Creating next_master_bill_number function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.next_master_bill_number(p_branch_id integer)
    RETURNS text
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_next integer;
      v_code text;
    BEGIN
      INSERT INTO public.pos_master_bill_counters (branch_id, last_number)
      VALUES (p_branch_id, 1)
      ON CONFLICT (branch_id)
      DO UPDATE SET last_number = public.pos_master_bill_counters.last_number + 1
      RETURNING last_number INTO v_next;

      SELECT COALESCE(NULLIF(btrim(code), ''), 'BR' || p_branch_id)
        INTO v_code FROM public.branches WHERE id = p_branch_id;
      IF v_code IS NULL THEN v_code := 'BR' || p_branch_id; END IF;

      RETURN v_code || '-' || lpad(v_next::text, 6, '0');
    END;
    $$;
  `);
  console.log('FUNCTION next_master_bill_number SUCCESS!');

  console.log('Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('POSTGREST SCHEMA RELOAD SUCCESS!');

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
