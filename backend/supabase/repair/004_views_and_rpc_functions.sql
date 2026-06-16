-- 004 Views and RPC function compatibility drafts
-- Review business logic before applying; these preserve route availability but may need domain-specific refinement.

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE affected INTEGER;
BEGIN
  UPDATE public.store_dispatches
  SET otp_code = NULL, otp_expires_at = NULL
  WHERE otp_expires_at IS NOT NULL AND otp_expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
CREATE OR REPLACE FUNCTION public.generate_dispatch_otp(dispatch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE code TEXT;
BEGIN
  code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.store_dispatches
  SET otp_code = code, otp_expires_at = now() + interval '15 minutes', updated_at = now()
  WHERE id = dispatch_id;
  RETURN code;
END;
$$;
CREATE OR REPLACE FUNCTION public.verify_dispatch_otp(dispatch_id UUID, provided_otp TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT otp_code = provided_otp AND otp_expires_at > now()
  INTO ok
  FROM public.store_dispatches
  WHERE id = dispatch_id;
  RETURN coalesce(ok, false);
END;
$$;
CREATE OR REPLACE FUNCTION public.update_tab_total(tab_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Placeholder compatibility function. Confirm bar tab table names before applying.
  RETURN;
END;
$$;
-- update_stock_level and receive_purchase_order are inventory-mutating RPCs.
-- Do not add permissive placeholder functions for them.
-- Implement them through the canonical inventory movement ledger service instead.
-- calculate_conference_invoice_with_attendance requires conference billing rules.
-- Keep as a controller/service implementation unless the finalized function body is reviewed.
