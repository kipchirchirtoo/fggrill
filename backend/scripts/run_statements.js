require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB');

  // Step 1: Create pos_master_bill_counters
  console.log('1. Creating pos_master_bill_counters...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.pos_master_bill_counters (
      branch_id   integer PRIMARY KEY,
      last_number integer NOT NULL DEFAULT 0
    );
  `);
  console.log('Done 1.');

  // Step 2: Create pos_master_bills
  console.log('2. Creating pos_master_bills...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.pos_master_bills (
      id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      master_bill_number       text UNIQUE NOT NULL,
      branch_id                integer NOT NULL,
      origin_outlet_id         uuid,
      origin_outlet_name       text,
      table_number             text,
      customer_name            text,
      opening_waiter_id        uuid,
      opening_waiter_name      text,
      settlement_cashier_id    uuid,
      settlement_cashier_name  text,
      payment_method           text,
      status                   text NOT NULL DEFAULT 'open',
      total_amount             numeric NOT NULL DEFAULT 0,
      amount_paid              numeric NOT NULL DEFAULT 0,
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now(),
      bill_requested_at        timestamptz,
      paid_at                  timestamptz,
      closed_at                timestamptz
    );
    CREATE INDEX IF NOT EXISTS idx_pos_master_bills_branch_status
      ON public.pos_master_bills (branch_id, status);
  `);
  console.log('Done 2.');

  // Step 3: Create pos_master_bill_settlements
  console.log('3. Creating pos_master_bill_settlements...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.pos_master_bill_settlements (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      master_bill_id        uuid NOT NULL REFERENCES public.pos_master_bills(id) ON DELETE CASCADE,
      branch_id             integer NOT NULL,
      outlet_id             uuid NOT NULL,
      outlet_name           text,
      amount                numeric NOT NULL DEFAULT 0,
      is_origin             boolean NOT NULL DEFAULT false,
      collecting_cashier_id uuid,
      status                text NOT NULL DEFAULT 'open',
      confirmed_by          uuid,
      confirmed_at          timestamptz,
      dispute_reason        text,
      payment_method        text,
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now(),
      UNIQUE (master_bill_id, outlet_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_outlet
      ON public.pos_master_bill_settlements (branch_id, outlet_id, status);
  `);
  console.log('Done 3.');

  // Step 4: Alter pos_shift_orders
  console.log('4. Altering pos_shift_orders...');
  await client.query(`
    ALTER TABLE public.pos_shift_orders
      ADD COLUMN IF NOT EXISTS master_bill_id  uuid,
      ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';
    CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_master_bill
      ON public.pos_shift_orders (master_bill_id) WHERE master_bill_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_waiter_open
      ON public.pos_shift_orders (branch_id, waiter_id, payment_status);
  `);
  console.log('Done 4.');

  // Step 5: Function next_master_bill_number
  console.log('5. Creating function next_master_bill_number...');
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
  console.log('Done 5.');

  // Reload PostgREST schema cache
  console.log('Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('All steps completed successfully!');

  await client.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
