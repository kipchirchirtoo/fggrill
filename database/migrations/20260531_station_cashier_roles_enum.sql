-- Add station-specific cashier roles used by unified POS outlet routing.
-- These roles are assigned to system users; employee records remain sourced
-- from staff_profiles and should not be duplicated from user accounts.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype
        AND enumlabel = 'restaurant_cashier'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'restaurant_cashier';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype
        AND enumlabel = 'main_bar_cashier'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'main_bar_cashier';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype
        AND enumlabel = 'executive_bar_cashier'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'executive_bar_cashier';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype
        AND enumlabel = 'non_consumables_cashier'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'non_consumables_cashier';
    END IF;
  END IF;
END $$;

COMMENT ON TYPE user_role IS
  'User roles including station-specific cashier roles for restaurant, main bar, executive bar, and non-consumables POS stations.';
