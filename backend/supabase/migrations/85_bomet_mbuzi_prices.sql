-- ============================================================
-- FamousGate Bomet Town — Update Mbuzi prices
-- ============================================================

DO $$
DECLARE
    v_branch_id INTEGER;
BEGIN
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'BOM' OR name ILIKE '%bomet%'
    ORDER BY id LIMIT 1;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Bomet branch not found.';
    END IF;

    UPDATE restaurant_menu_items SET price = 350  WHERE name = 'Mbuzi Wet Fry (1/4)'   AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 700  WHERE name = 'Mbuzi Wet Fry (1/2)'   AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 1400 WHERE name = 'Mbuzi Wet Fry (1kg)'   AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 350  WHERE name = 'Mbuzi Panfried (1/4)'  AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 700  WHERE name = 'Mbuzi Panfried (1/2)'  AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 1400 WHERE name = 'Mbuzi Panfried (1kg)'  AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 350  WHERE name = 'Mbuzi Choma (1/4)'     AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 700  WHERE name = 'Mbuzi Choma (1/2)'     AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 1400 WHERE name = 'Mbuzi Choma (1kg)'     AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 350  WHERE name = 'Mbuzi Boiled (1/4)'    AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 700  WHERE name = 'Mbuzi Boiled (1/2)'    AND branch_id = v_branch_id;
    UPDATE restaurant_menu_items SET price = 1400 WHERE name = 'Mbuzi Boiled (1kg)'    AND branch_id = v_branch_id;

    RAISE NOTICE 'Mbuzi prices updated for branch_id = %', v_branch_id;
END $$;
