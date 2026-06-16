-- Pin Kyogong as the central warehouse branch and keep central-store users aligned.

DO $$
DECLARE
  v_central_branch_id integer;
BEGIN
  SELECT id
  INTO v_central_branch_id
  FROM public.branches
  WHERE id = 1
    AND (upper(code) = 'KYO' OR upper(name) = 'KYOGONG')
  LIMIT 1;

  IF v_central_branch_id IS NULL THEN
    SELECT id
    INTO v_central_branch_id
    FROM public.branches
    WHERE upper(code) = 'KYO' OR upper(name) = 'KYOGONG'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_central_branch_id IS NULL THEN
    RAISE EXCEPTION 'Kyogong branch not found; cannot configure central warehouse';
  END IF;

  UPDATE public.branches
  SET
    is_central_warehouse = (id = v_central_branch_id),
    is_main_branch = CASE WHEN id = v_central_branch_id THEN true ELSE is_main_branch END,
    updated_at = now()
  WHERE is_central_warehouse IS DISTINCT FROM (id = v_central_branch_id)
     OR (id = v_central_branch_id AND is_main_branch IS DISTINCT FROM true);

  UPDATE public.users
  SET
    branch_id = v_central_branch_id,
    updated_at = now()
  WHERE role = 'central_storekeeper'
    AND branch_id IS DISTINCT FROM v_central_branch_id;

  INSERT INTO public.inventory_locations (
    branch_id,
    location_code,
    name,
    location_type,
    is_active,
    metadata
  )
  VALUES (
    v_central_branch_id,
    'CENTRAL-STORE-' || v_central_branch_id,
    'Central Store',
    'central_store',
    true,
    '{}'::jsonb
  )
  ON CONFLICT (branch_id, location_code)
  DO UPDATE SET
    name = excluded.name,
    location_type = excluded.location_type,
    is_active = true,
    updated_at = now();
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_central_warehouse
  ON public.branches (is_central_warehouse)
  WHERE is_central_warehouse = true;

CREATE OR REPLACE FUNCTION public.force_central_storekeeper_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_central_branch_id integer;
BEGIN
  IF NEW.role = 'central_storekeeper' THEN
    SELECT id
    INTO v_central_branch_id
    FROM public.branches
    WHERE is_central_warehouse = true
    ORDER BY CASE WHEN id = 1 THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF v_central_branch_id IS NOT NULL THEN
      NEW.branch_id := v_central_branch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_central_storekeeper_branch ON public.users;
CREATE TRIGGER trg_force_central_storekeeper_branch
BEFORE INSERT OR UPDATE OF role, branch_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.force_central_storekeeper_branch();
