require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  let doneMaster = false;
  let doneSub = false;
  let attempts = 0;

  while ((!doneMaster || !doneSub) && attempts < 30) {
    attempts++;
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      await client.query("SET lock_timeout = '3s';");

      // Terminate any active queries querying pos_shift_orders
      await client.query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE pid <> pg_backend_pid() 
          AND state = 'active'
          AND query LIKE '%pos_shift_orders%';
      `);

      if (!doneMaster) {
        await client.query("ALTER TABLE public.pos_shift_orders ADD COLUMN IF NOT EXISTS master_bill_id uuid;");
        console.log('master_bill_id column added successfully!');
        doneMaster = true;
      }

      if (!doneSub) {
        await client.query("ALTER TABLE public.pos_shift_orders ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';");
        console.log('sub_bill_status column added successfully!');
        doneSub = true;
      }

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
      console.log('Function next_master_bill_number created successfully!');

      await client.query("NOTIFY pgrst, 'reload schema';");
      console.log('PostgREST schema cache reloaded successfully!');
    } catch (err) {
      console.log(`Attempt ${attempts} failed (${err.message}), retrying...`);
      await new Promise(r => setTimeout(r, 500));
    } finally {
      await client.end().catch(() => {});
    }
  }

  if (doneMaster && doneSub) {
    console.log('=== ALL MIGRATIONS COMPLETED SUCCESSFULLY! ===');
  }
}

main().catch(console.error);
