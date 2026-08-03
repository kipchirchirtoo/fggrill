-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260803_create_offers.sql
-- Purpose:   Branch-manager-defined Discounts & Offers
--
-- Offers target either POS menu items (restaurant / bar) or room rates.
-- Active offers are surfaced at the POS till as an "OFFER" tag and flow
-- into customer bills. Room-rate offers apply when receptionists create
-- bookings (effectiveRate = base − discount).
--
-- target_type    | item_kind          | target_id / target_label
-- ───────────────┼────────────────────┼───────────────────────────────────────
-- menu_item      | 'restaurant'|'bar' | UUID of the menu item
-- menu_category  | 'restaurant'|'bar' | UUID of the category (label = name)
-- outlet         | 'restaurant'|'bar' | NULL (whole menu)
-- room_type      | NULL               | room-type name string (e.g. 'Deluxe')
-- all_rooms      | NULL               | NULL (every room in the branch)
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id        INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Offer identity
    name             TEXT NOT NULL,
    description      TEXT,

    -- Discount rule
    discount_type    TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value   NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),

    -- What this offer applies to
    target_type      TEXT NOT NULL
                         CHECK (target_type IN ('menu_item', 'menu_category', 'outlet',
                                                'room_type', 'all_rooms')),
    item_kind        TEXT CHECK (item_kind IN ('restaurant', 'bar')),  -- NULL for room offers
    target_id        TEXT,          -- item/category UUID, or room-type name string
    target_label     TEXT,          -- denormalised display name (survives item renames)

    -- Activation & validity window
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    starts_on        DATE,          -- NULL = no lower bound
    ends_on          DATE,          -- NULL = no upper bound

    -- Audit
    created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: menu-type offers must declare item_kind
ALTER TABLE public.offers
    ADD CONSTRAINT offers_menu_kind_required
    CHECK (
        target_type NOT IN ('menu_item', 'menu_category', 'outlet')
        OR item_kind IS NOT NULL
    );

-- Constraint: percentage discount cannot exceed 100
ALTER TABLE public.offers
    ADD CONSTRAINT offers_percentage_max
    CHECK (
        discount_type <> 'percentage'
        OR discount_value <= 100
    );

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- POS / reception queries: active offers for a branch today
CREATE INDEX IF NOT EXISTS idx_offers_branch_active
    ON public.offers (branch_id, is_active)
    WHERE is_active = TRUE;

-- Management list (branch manager dashboard)
CREATE INDEX IF NOT EXISTS idx_offers_branch_created
    ON public.offers (branch_id, created_at DESC);

-- Filter by target_type
CREATE INDEX IF NOT EXISTS idx_offers_target_type
    ON public.offers (branch_id, target_type);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.offers_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.offers_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated in the same branch may read active offers (POS, reception)
CREATE POLICY offers_read ON public.offers
    FOR SELECT
    USING (
        branch_id = (
            SELECT branch_id
            FROM public.user_branch_roles
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Only managers / super-admin may write
CREATE POLICY offers_write ON public.offers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_branch_roles ubr
            WHERE ubr.user_id  = auth.uid()
              AND ubr.branch_id = offers.branch_id
              AND ubr.role IN (
                  'super_admin', 'general_manager',
                  'branch_manager', 'director'
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_branch_roles ubr
            WHERE ubr.user_id  = auth.uid()
              AND ubr.branch_id = offers.branch_id
              AND ubr.role IN (
                  'super_admin', 'general_manager',
                  'branch_manager', 'director'
              )
        )
    );

COMMENT ON TABLE public.offers IS
    'Branch-manager-defined promotional discounts for POS menu items and room rates.';
