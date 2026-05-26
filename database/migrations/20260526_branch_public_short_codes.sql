-- Branch-scoped public short codes for orders, bills, receipts, and POS payments.
-- Codes are plain uppercase alphanumeric strings, 4 or 6 characters long.
-- Ambiguous characters are excluded: 0, O, I, 1.

DROP FUNCTION IF EXISTS public.generate_public_short_code(REGCLASS, INTEGER);

CREATE OR REPLACE FUNCTION public.generate_public_short_code(
  p_table REGCLASS,
  p_branch_key TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  allowed_chars CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code_len INTEGER;
  generated_code TEXT;
  code_exists BOOLEAN;
  has_branch_id BOOLEAN;
  i INTEGER;
  attempt INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = p_table
      AND attname = 'branch_id'
      AND NOT attisdropped
  ) INTO has_branch_id;

  FOR attempt IN 1..100 LOOP
    code_len := CASE WHEN random() < 0.5 THEN 4 ELSE 6 END;
    generated_code := '';

    FOR i IN 1..code_len LOOP
      generated_code := generated_code ||
        substr(allowed_chars, floor(random() * length(allowed_chars) + 1)::INTEGER, 1);
    END LOOP;

    IF has_branch_id THEN
      EXECUTE format(
        'SELECT EXISTS (
           SELECT 1 FROM %s
           WHERE short_code = $1
             AND COALESCE(branch_id::TEXT, '''') = COALESCE($2, '''')
         )',
        p_table
      )
      USING generated_code, p_branch_key
      INTO code_exists;
    ELSE
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %s WHERE short_code = $1)',
        p_table
      )
      USING generated_code
      INTO code_exists;
    END IF;

    IF NOT code_exists THEN
      RETURN generated_code;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Unable to generate unique public short code for % after 100 attempts', p_table;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_public_short_code()
RETURNS TRIGGER AS $$
DECLARE
  row_branch_key TEXT;
BEGIN
  row_branch_key := NULLIF(to_jsonb(NEW)->>'branch_id', '');

  IF NEW.short_code IS NULL OR btrim(NEW.short_code) = '' THEN
    NEW.short_code := public.generate_public_short_code(TG_RELID::REGCLASS, row_branch_key);
  ELSE
    NEW.short_code := upper(regexp_replace(NEW.short_code, '[^A-Z0-9]', '', 'g'));

    IF NEW.short_code !~ '^(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}|[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6})$' THEN
      RAISE EXCEPTION 'Invalid short_code %. Use 4 or 6 chars from 2-9 and A-Z excluding 0, O, I, 1.', NEW.short_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name TEXT;
  table_reg REGCLASS;
  has_branch_id BOOLEAN;
  unique_index_name TEXT;
  trigger_name TEXT;
  target_tables TEXT[] := ARRAY[
    'restaurant_orders',
    'bar_orders',
    'restaurant_bills',
    'restaurant_bill_payments',
    'pos_transactions',
    'cashier_transactions',
    'payments',
    'receipts',
    'unpaid_bills',
    'credit_bills',
    'staff_credit_bills',
    'staff_credit_bill_payments',
    'pos_shift_orders',
    'pos_shift_payments',
    'shift_transactions',
    'conference_hall_bookings',
    'reservations',
    'finance_invoices',
    'accounting_ar_invoices'
  ];
BEGIN
  FOREACH table_name IN ARRAY target_tables LOOP
    table_reg := to_regclass('public.' || table_name);
    IF table_reg IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS short_code TEXT', table_reg);

    EXECUTE format(
      'UPDATE %s AS t
       SET short_code = public.generate_public_short_code(%L::REGCLASS, NULLIF(to_jsonb(t)->>''branch_id'', ''''))
       WHERE t.short_code IS NULL OR btrim(t.short_code) = ''''',
      table_reg,
      table_reg::TEXT
    );

    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = table_reg
        AND attname = 'branch_id'
        AND NOT attisdropped
    ) INTO has_branch_id;

    unique_index_name := left(table_name || '_short_code_branch_uidx', 63);

    IF has_branch_id THEN
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I
           ON %s (COALESCE(branch_id::TEXT, ''''), short_code)
         WHERE short_code IS NOT NULL',
        unique_index_name,
        table_reg
      );
    ELSE
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I
           ON %s (short_code)
         WHERE short_code IS NOT NULL',
        unique_index_name,
        table_reg
      );
    END IF;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (short_code)', left(table_name || '_short_code_idx', 63), table_reg);

    trigger_name := left('trigger_set_' || table_name || '_short_code', 63);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_reg);
    EXECUTE format(
      'CREATE TRIGGER %I
       BEFORE INSERT OR UPDATE OF short_code ON %s
       FOR EACH ROW
       EXECUTE FUNCTION public.set_public_short_code()',
      trigger_name,
      table_reg
    );

    EXECUTE format('COMMENT ON COLUMN %s.short_code IS %L', table_reg, 'Branch-scoped public lookup code using 2-9 and A-Z excluding 0, O, I, 1.');
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
