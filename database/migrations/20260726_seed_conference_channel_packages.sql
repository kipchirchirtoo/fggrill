-- =====================================================
-- SEED CONFERENCE CHANNEL PACKAGES & FOOD STANDARDS
-- Migration: 20260726_seed_conference_channel_packages.sql
-- Description:
--   Seeds the 4 commercial conference packages for channel 'conference_event'
--   across active branches (Kyogong branch_id=1, etc.) along with default
--   served POS menu items (channel_package_menu_items) and raw food stock
--   standards (channel_food_standards) to satisfy the completeness guard.
-- =====================================================

DO $$
DECLARE
  b_id INT;
  half_day_id UUID;
  full_day_id UUID;
  half_board_id UUID;
  full_board_id UUID;
BEGIN
  -- Loop through active branches (or branch_id = 1 if single branch setup)
  FOR b_id IN SELECT id FROM public.branches WHERE is_active = TRUE LOOP

    -- 1. Half day Package (KES 1,800)
    INSERT INTO public.channel_package_definitions (branch_id, channel, package_name, is_active)
    VALUES (b_id, 'conference_event', 'Half day', TRUE)
    ON CONFLICT (branch_id, channel, package_name)
    DO UPDATE SET is_active = TRUE, updated_at = NOW()
    RETURNING id INTO half_day_id;

    -- Served POS menu items for Half day
    INSERT INTO public.channel_package_menu_items (branch_id, channel, package_id, package_name, item_name, quantity_per_pax, unit, package_definition_id)
    VALUES 
      (b_id, 'conference_event', half_day_id, 'Half day', '10am Tea & Snacks', 1.0, 'serving', half_day_id),
      (b_id, 'conference_event', half_day_id, 'Half day', 'Buffet Lunch', 1.0, 'plate', half_day_id),
      (b_id, 'conference_event', half_day_id, 'Half day', '500ml Mineral Water', 1.0, 'bottle', half_day_id)
    ON CONFLICT DO NOTHING;

    -- Raw food standards for Half day
    INSERT INTO public.channel_food_standards (branch_id, channel, raw_item_sku, raw_item_name, quantity_per_pax, unit, package_definition_id)
    VALUES
      (b_id, 'conference_event', 'RAW-WATER-500', '500ml Mineral Water', 1.0, 'bottle', half_day_id),
      (b_id, 'conference_event', 'RAW-RICE-KG', 'Rice', 0.15, 'kg', half_day_id),
      (b_id, 'conference_event', 'RAW-BEEF-KG', 'Beef', 0.20, 'kg', half_day_id),
      (b_id, 'conference_event', 'RAW-MILK-L', 'Fresh Milk', 0.20, 'litre', half_day_id)
    ON CONFLICT (branch_id, channel, event_id, raw_item_sku) DO NOTHING;

    -- 2. Full day Package (KES 2,500)
    INSERT INTO public.channel_package_definitions (branch_id, channel, package_name, is_active)
    VALUES (b_id, 'conference_event', 'Full day', TRUE)
    ON CONFLICT (branch_id, channel, package_name)
    DO UPDATE SET is_active = TRUE, updated_at = NOW()
    RETURNING id INTO full_day_id;

    -- Served POS menu items for Full day
    INSERT INTO public.channel_package_menu_items (branch_id, channel, package_id, package_name, item_name, quantity_per_pax, unit, package_definition_id)
    VALUES 
      (b_id, 'conference_event', full_day_id, 'Full day', '10am Tea & Snacks', 1.0, 'serving', full_day_id),
      (b_id, 'conference_event', full_day_id, 'Full day', 'Buffet Lunch', 1.0, 'plate', full_day_id),
      (b_id, 'conference_event', full_day_id, 'Full day', '4pm Tea & Snacks', 1.0, 'serving', full_day_id),
      (b_id, 'conference_event', full_day_id, 'Full day', '500ml Mineral Water', 2.0, 'bottle', full_day_id)
    ON CONFLICT DO NOTHING;

    -- Raw food standards for Full day
    INSERT INTO public.channel_food_standards (branch_id, channel, raw_item_sku, raw_item_name, quantity_per_pax, unit, package_definition_id)
    VALUES
      (b_id, 'conference_event', 'RAW-WATER-500', '500ml Mineral Water', 2.0, 'bottle', full_day_id),
      (b_id, 'conference_event', 'RAW-RICE-KG', 'Rice', 0.20, 'kg', full_day_id),
      (b_id, 'conference_event', 'RAW-BEEF-KG', 'Beef', 0.25, 'kg', full_day_id),
      (b_id, 'conference_event', 'RAW-MILK-L', 'Fresh Milk', 0.35, 'litre', full_day_id)
    ON CONFLICT (branch_id, channel, event_id, raw_item_sku) DO NOTHING;

    -- 3. Half board Package (KES 6,500)
    INSERT INTO public.channel_package_definitions (branch_id, channel, package_name, is_active)
    VALUES (b_id, 'conference_event', 'Half board', TRUE)
    ON CONFLICT (branch_id, channel, package_name)
    DO UPDATE SET is_active = TRUE, updated_at = NOW()
    RETURNING id INTO half_board_id;

    -- Served POS menu items for Half board
    INSERT INTO public.channel_package_menu_items (branch_id, channel, package_id, package_name, item_name, quantity_per_pax, unit, package_definition_id)
    VALUES 
      (b_id, 'conference_event', half_board_id, 'Half board', 'Bed & Breakfast', 1.0, 'night', half_board_id),
      (b_id, 'conference_event', half_board_id, 'Half board', '10am Tea & Snacks', 1.0, 'serving', half_board_id),
      (b_id, 'conference_event', half_board_id, 'Half board', 'Buffet Lunch', 1.0, 'plate', half_board_id),
      (b_id, 'conference_event', half_board_id, 'Half board', '500ml Mineral Water', 2.0, 'bottle', half_board_id)
    ON CONFLICT DO NOTHING;

    -- Raw food standards for Half board
    INSERT INTO public.channel_food_standards (branch_id, channel, raw_item_sku, raw_item_name, quantity_per_pax, unit, package_definition_id)
    VALUES
      (b_id, 'conference_event', 'RAW-WATER-500', '500ml Mineral Water', 2.0, 'bottle', half_board_id),
      (b_id, 'conference_event', 'RAW-RICE-KG', 'Rice', 0.25, 'kg', half_board_id),
      (b_id, 'conference_event', 'RAW-BEEF-KG', 'Beef', 0.30, 'kg', half_board_id),
      (b_id, 'conference_event', 'RAW-MILK-L', 'Fresh Milk', 0.40, 'litre', half_board_id)
    ON CONFLICT (branch_id, channel, event_id, raw_item_sku) DO NOTHING;

    -- 4. Full board Package (KES 7,500)
    INSERT INTO public.channel_package_definitions (branch_id, channel, package_name, is_active)
    VALUES (b_id, 'conference_event', 'Full board', TRUE)
    ON CONFLICT (branch_id, channel, package_name)
    DO UPDATE SET is_active = TRUE, updated_at = NOW()
    RETURNING id INTO full_board_id;

    -- Served POS menu items for Full board
    INSERT INTO public.channel_package_menu_items (branch_id, channel, package_id, package_name, item_name, quantity_per_pax, unit, package_definition_id)
    VALUES 
      (b_id, 'conference_event', full_board_id, 'Full board', 'Bed & Breakfast', 1.0, 'night', full_board_id),
      (b_id, 'conference_event', full_board_id, 'Full board', '10am Tea & Snacks', 1.0, 'serving', full_board_id),
      (b_id, 'conference_event', full_board_id, 'Full board', 'Buffet Lunch', 1.0, 'plate', full_board_id),
      (b_id, 'conference_event', full_board_id, 'Full board', '4pm Tea & Snacks', 1.0, 'serving', full_board_id),
      (b_id, 'conference_event', full_board_id, 'Full board', 'Dinner', 1.0, 'plate', full_board_id),
      (b_id, 'conference_event', full_board_id, 'Full board', '500ml Mineral Water', 2.0, 'bottle', full_board_id)
    ON CONFLICT DO NOTHING;

    -- Raw food standards for Full board
    INSERT INTO public.channel_food_standards (branch_id, channel, raw_item_sku, raw_item_name, quantity_per_pax, unit, package_definition_id)
    VALUES
      (b_id, 'conference_event', 'RAW-WATER-500', '500ml Mineral Water', 2.0, 'bottle', full_board_id),
      (b_id, 'conference_event', 'RAW-RICE-KG', 'Rice', 0.30, 'kg', full_board_id),
      (b_id, 'conference_event', 'RAW-BEEF-KG', 'Beef', 0.40, 'kg', full_board_id),
      (b_id, 'conference_event', 'RAW-MILK-L', 'Fresh Milk', 0.50, 'litre', full_board_id)
    ON CONFLICT (branch_id, channel, event_id, raw_item_sku) DO NOTHING;

  END LOOP;
END $$;
