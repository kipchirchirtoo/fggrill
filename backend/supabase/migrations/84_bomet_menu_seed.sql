-- ============================================================
-- FamousGate Bomet Town — Restaurant Menu Seed
-- Branch: Kyogong Bomet (code: BOM, location: Bomet Town)
-- Run AFTER 20260522_menu_branch_support.sql
-- Mbuzi prices set to 0.00 — update once prices are confirmed.
-- ============================================================

DO $$
DECLARE
    v_branch_id     INTEGER;
    cat_beef        UUID;
    cat_fish        UUID;
    cat_chicken     UUID;
    cat_mbuzi       UUID;
    cat_acc         UUID;
    cat_veg         UUID;
    cat_specials    UUID;
    cat_snacks      UUID;
    cat_hot_bev     UUID;
    cat_breakfast   UUID;
    cat_platters    UUID;
BEGIN

    -- ── Resolve Bomet branch ID ───────────────────────────────
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'BOM' OR name ILIKE '%bomet%'
    ORDER BY id
    LIMIT 1;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Bomet branch not found. Ensure branches table has a Bomet entry.';
    END IF;

    RAISE NOTICE 'Seeding menu for Bomet branch_id = %', v_branch_id;

    -- ── Ensure all required categories exist for this branch ──
    INSERT INTO restaurant_menu_categories (name, sort_order, branch_id) VALUES
        ('BEEF',          10, v_branch_id),
        ('FISH',           6, v_branch_id),
        ('CHICKEN',       11, v_branch_id),
        ('MBUZI',         12, v_branch_id),
        ('ACCOMPANIMENTS', 8, v_branch_id),
        ('VEGETABLES',     9, v_branch_id),
        ('SPECIALS',       2, v_branch_id),
        ('SNACKS',         0, v_branch_id),
        ('HOT BEVERAGES', 15, v_branch_id),
        ('BREAKFAST',     16, v_branch_id),
        ('PLATTERS',      17, v_branch_id)
    ON CONFLICT DO NOTHING;

    -- ── Fetch category IDs for this branch ────────────────────
    SELECT id INTO cat_beef     FROM restaurant_menu_categories WHERE name = 'BEEF'          AND branch_id = v_branch_id;
    SELECT id INTO cat_fish     FROM restaurant_menu_categories WHERE name = 'FISH'          AND branch_id = v_branch_id;
    SELECT id INTO cat_chicken  FROM restaurant_menu_categories WHERE name = 'CHICKEN'       AND branch_id = v_branch_id;
    SELECT id INTO cat_mbuzi    FROM restaurant_menu_categories WHERE name = 'MBUZI'         AND branch_id = v_branch_id;
    SELECT id INTO cat_acc      FROM restaurant_menu_categories WHERE name = 'ACCOMPANIMENTS' AND branch_id = v_branch_id;
    SELECT id INTO cat_veg      FROM restaurant_menu_categories WHERE name = 'VEGETABLES'    AND branch_id = v_branch_id;
    SELECT id INTO cat_specials FROM restaurant_menu_categories WHERE name = 'SPECIALS'      AND branch_id = v_branch_id;
    SELECT id INTO cat_snacks   FROM restaurant_menu_categories WHERE name = 'SNACKS'        AND branch_id = v_branch_id;
    SELECT id INTO cat_hot_bev  FROM restaurant_menu_categories WHERE name = 'HOT BEVERAGES' AND branch_id = v_branch_id;
    SELECT id INTO cat_breakfast FROM restaurant_menu_categories WHERE name = 'BREAKFAST'    AND branch_id = v_branch_id;
    SELECT id INTO cat_platters FROM restaurant_menu_categories WHERE name = 'PLATTERS'      AND branch_id = v_branch_id;

    -- ── BEEF ──────────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time, description) VALUES
        (cat_beef, v_branch_id, 'Beef Stew (1/4)',        400,  25, '1/4 portion'),
        (cat_beef, v_branch_id, 'Beef Stew (1/2)',        800,  25, '1/2 portion'),
        (cat_beef, v_branch_id, 'Beef Stew (1kg)',       1600,  30, '1kg portion'),
        (cat_beef, v_branch_id, 'Beef Panfried (1/4)',    400,  25, '1/4 portion'),
        (cat_beef, v_branch_id, 'Beef Panfried (1/2)',    800,  25, '1/2 portion'),
        (cat_beef, v_branch_id, 'Beef Panfried (1kg)',   1600,  30, '1kg portion'),
        (cat_beef, v_branch_id, 'Beef Wet Fry (1/4)',     400,  25, '1/4 portion'),
        (cat_beef, v_branch_id, 'Beef Wet Fry (1/2)',     800,  25, '1/2 portion'),
        (cat_beef, v_branch_id, 'Beef Wet Fry (1kg)',    1600,  30, '1kg portion'),
        (cat_beef, v_branch_id, 'Beef Tumbukiza (1/4)',   300,  30, '1/4 portion'),
        (cat_beef, v_branch_id, 'Beef Tumbukiza (1/2)',   500,  30, '1/2 portion'),
        (cat_beef, v_branch_id, 'Beef Tumbukiza (1kg)',  1000,  35, '1kg portion');

    -- ── FISH ──────────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_fish, v_branch_id, 'Fish Dry (Whole)',  550, 20),
        (cat_fish, v_branch_id, 'Fish Wet (Whole)',  600, 20),
        (cat_fish, v_branch_id, 'Fish Boiled',       500, 20),
        (cat_fish, v_branch_id, 'Fish Fingers',      450, 15);

    -- ── CHICKEN ───────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time, description) VALUES
        (cat_chicken, v_branch_id, 'Chicken Wet Fry (1/4)',          350, 25, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Chicken Wet Fry (1/2)',          700, 25, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Chicken Wet Fry (Full)',        1400, 35, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Chicken Pan Fry (1/4)',          350, 25, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Chicken Pan Fry (1/2)',          700, 25, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Chicken Pan Fry (Full)',        1400, 35, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Chicken Dry Fry (1/4)',          350, 25, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Chicken Dry Fry (1/2)',          700, 25, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Chicken Dry Fry (Full)',        1400, 35, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Kuku Kienyeji (1/4)',            350, 30, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Kuku Kienyeji (1/2)',            700, 30, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Kuku Kienyeji (Full)',          1400, 40, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Kuku Wet Fry Kienyeji (1/4)',    350, 30, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Kuku Wet Fry Kienyeji (1/2)',    700, 30, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Kuku Wet Fry Kienyeji (Full)', 1400, 40, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Kuku Dry Fry Kienyeji (1/4)',    350, 30, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Kuku Dry Fry Kienyeji (1/2)',    700, 30, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Kuku Dry Fry Kienyeji (Full)', 1400, 40, 'Full chicken'),
        (cat_chicken, v_branch_id, 'Kuku Pan Fry Kienyeji (1/4)',    350, 30, '1/4 portion'),
        (cat_chicken, v_branch_id, 'Kuku Pan Fry Kienyeji (1/2)',    700, 30, '1/2 portion'),
        (cat_chicken, v_branch_id, 'Kuku Pan Fry Kienyeji (Full)', 1400, 40, 'Full chicken');

    -- ── MBUZI (prices TBD — set to 0, update when confirmed) ─
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time, description) VALUES
        (cat_mbuzi, v_branch_id, 'Mbuzi Wet Fry (1/4)',   0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Wet Fry (1/2)',   0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Wet Fry (1kg)',   0, 40, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Panfried (1/4)',  0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Panfried (1/2)',  0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Panfried (1kg)',  0, 40, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Choma (1/4)',     0, 40, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Choma (1/2)',     0, 40, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Choma (1kg)',     0, 45, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Boiled (1/4)',    0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Boiled (1/2)',    0, 35, 'Price TBD'),
        (cat_mbuzi, v_branch_id, 'Mbuzi Boiled (1kg)',    0, 40, 'Price TBD');

    -- ── ACCOMPANIMENTS ────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_acc, v_branch_id, 'Ugali White',      70,  10),
        (cat_acc, v_branch_id, 'Ugali Brown',      70,  10),
        (cat_acc, v_branch_id, 'Chips',           100,  15),
        (cat_acc, v_branch_id, 'Roast Potatoes',  150,  20),
        (cat_acc, v_branch_id, 'Mashed Potatoes', 200,  15),
        (cat_acc, v_branch_id, 'Saute Potatoes',  200,  15),
        (cat_acc, v_branch_id, 'Mokimo',          200,  20),
        (cat_acc, v_branch_id, 'Pilau',           250,  20),
        (cat_acc, v_branch_id, 'Rice Plain',      200,  15),
        (cat_acc, v_branch_id, 'Matoke',          150,  20),
        (cat_acc, v_branch_id, 'Bhajia',          250,  15),
        (cat_acc, v_branch_id, 'Chips Masala',    250,  20),
        (cat_acc, v_branch_id, 'Garlic Chips',    200,  20);

    -- ── VEGETABLES (Plain & Mixed) ────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time, description, is_vegetarian) VALUES
        (cat_veg, v_branch_id, 'Sukuma (Plain)',   0, 10, 'Plain sukuma wiki',    true),
        (cat_veg, v_branch_id, 'Cabbage (Plain)',  0, 10, 'Plain cabbage',        true),
        (cat_veg, v_branch_id, 'Managu (Plain)',   0, 10, 'Plain managu',         true),
        (cat_veg, v_branch_id, 'Sukuma (Mixed)',   0, 10, 'Mixed preparation',    true),
        (cat_veg, v_branch_id, 'Cabbage (Mixed)',  0, 10, 'Mixed preparation',    true),
        (cat_veg, v_branch_id, 'Managu (Mixed)',   0, 10, 'Mixed preparation',    true),
        (cat_veg, v_branch_id, 'Mixed Veg',        0, 10, 'Vegetarian mixed veg', true),
        (cat_veg, v_branch_id, 'Peas (Minji)',     0, 10, 'Vegetarian',           true),
        (cat_veg, v_branch_id, 'Beans',            0, 15, 'Vegetarian',           true),
        (cat_veg, v_branch_id, 'Githeri',          0, 20, 'Vegetarian',           true),
        (cat_veg, v_branch_id, 'Spaghetti Bolognaise', 0, 20, 'Vegetarian',       true);

    -- ── SPECIALS ──────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_specials, v_branch_id, 'Special Mayai',       135, 10),
        (cat_specials, v_branch_id, 'Special Sausage',     150, 10),
        (cat_specials, v_branch_id, 'Special Samosa',      150,  5),
        (cat_specials, v_branch_id, 'Special Kebab',       250, 10),
        (cat_specials, v_branch_id, 'Special Githeri',     300, 15),
        (cat_specials, v_branch_id, 'Special Pilau',       350, 15),
        (cat_specials, v_branch_id, 'Special Chicken',       0, 25),
        (cat_specials, v_branch_id, 'Special Managu',      200, 10),
        (cat_specials, v_branch_id, 'Special Cabbage',       0, 10),
        (cat_specials, v_branch_id, 'Special Sukuma',        0, 10),
        (cat_specials, v_branch_id, 'Special Mix Managu',    0, 10);

    -- ── SNACKS ────────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_snacks, v_branch_id, 'Mahamri',                     50,  5),
        (cat_snacks, v_branch_id, 'Ndazi',                       50,  5),
        (cat_snacks, v_branch_id, 'Chapati',                     50,  5),
        (cat_snacks, v_branch_id, 'Brown Chapati',               70,  5),
        (cat_snacks, v_branch_id, 'Samosa',                      70,  5),
        (cat_snacks, v_branch_id, 'Sausage',                    100,  5),
        (cat_snacks, v_branch_id, 'Pan Cake',                    50,  5),
        (cat_snacks, v_branch_id, 'Dried Chapati',               70,  5),
        (cat_snacks, v_branch_id, 'Nduma',                      100,  5),
        (cat_snacks, v_branch_id, 'Toasted Bread',               50,  5),
        (cat_snacks, v_branch_id, 'Corn Flakes',                150,  3),
        (cat_snacks, v_branch_id, 'Egg Sandwich',               200, 10),
        (cat_snacks, v_branch_id, 'Scrambled Eggs (Kienyeji)',  100,  8),
        (cat_snacks, v_branch_id, 'Scrambled Eggs (Broiler)',   200,  8),
        (cat_snacks, v_branch_id, 'Spanish Omelette (Kienyeji)',200, 10),
        (cat_snacks, v_branch_id, 'Spanish Omelette (Broiler)', 150, 10),
        (cat_snacks, v_branch_id, 'Vegetable Sandwich',         100, 10),
        (cat_snacks, v_branch_id, 'Marble Cake',                100,  3),
        (cat_snacks, v_branch_id, 'Sweet Potatoes',              50, 10),
        (cat_snacks, v_branch_id, 'Cookies (Pair)',              50,  3),
        (cat_snacks, v_branch_id, 'Half Cake',                   70,  3),
        (cat_snacks, v_branch_id, 'Scones',                      40,  3),
        (cat_snacks, v_branch_id, 'Banana (2 pieces)',          100,  3),
        (cat_snacks, v_branch_id, 'Boiled Eggs (Broiler)',      150,  8),
        (cat_snacks, v_branch_id, 'Boiled Eggs (Kienyeji)',     150,  8),
        (cat_snacks, v_branch_id, 'Fried Eggs (Kienyeji)',      100,  8),
        (cat_snacks, v_branch_id, 'Fried Eggs (Broiler)',       200,  8),
        (cat_snacks, v_branch_id, 'Chapati Roll Kienyeji',      150,  8),
        (cat_snacks, v_branch_id, 'Chapati Roll Broiler',       100,  8),
        (cat_snacks, v_branch_id, 'Egg Fry Macho',               80,  8),
        (cat_snacks, v_branch_id, 'French Toast',               100, 10),
        (cat_snacks, v_branch_id, 'Queen Cakes',                100,  3),
        (cat_snacks, v_branch_id, 'Tea Scone (2 pcs)',          100,  3),
        (cat_snacks, v_branch_id, 'Poached Eggs',               100, 10),
        (cat_snacks, v_branch_id, 'Kebab',                      100,  5);

    -- ── BREAKFAST ─────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time, description) VALUES
        (cat_breakfast, v_branch_id, 'FG Breakfast',       200, 15, 'Milk, Ndazi, Butternut, Chai'),
        (cat_breakfast, v_branch_id, 'FG Special Breakfast', 400, 20, '1 Protein, 1 Starch, Fruit/Juice');

    -- ── HOT BEVERAGES ─────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_hot_bev, v_branch_id, 'Tea Mug',            50,  5),
        (cat_hot_bev, v_branch_id, 'Tea Pot',           100,  5),
        (cat_hot_bev, v_branch_id, 'Black Tea',          50,  5),
        (cat_hot_bev, v_branch_id, 'Lemon Tea',          70,  5),
        (cat_hot_bev, v_branch_id, 'Chocolate/Milo',     70,  5),
        (cat_hot_bev, v_branch_id, 'Black Coffee',       50,  5),
        (cat_hot_bev, v_branch_id, 'Lemon Tea Honey',   100,  5),
        (cat_hot_bev, v_branch_id, 'Lemon Coffee Honey',100,  5),
        (cat_hot_bev, v_branch_id, 'Honey Plain',        50,  3),
        (cat_hot_bev, v_branch_id, 'Ginger Tea',        150,  7),
        (cat_hot_bev, v_branch_id, 'Dawa',              100,  7),
        (cat_hot_bev, v_branch_id, 'Porridge',           70,  5),
        (cat_hot_bev, v_branch_id, 'Cocoa',              70,  5),
        (cat_hot_bev, v_branch_id, 'Tea Masala',         70,  7),
        (cat_hot_bev, v_branch_id, 'Hot Lemon',         100,  5),
        (cat_hot_bev, v_branch_id, 'Special Tea',        70,  5),
        (cat_hot_bev, v_branch_id, 'White Tea',          70,  5),
        (cat_hot_bev, v_branch_id, 'White Coffee',       70,  5);

    -- ── PLATTERS ──────────────────────────────────────────────
    INSERT INTO restaurant_menu_items (category_id, branch_id, name, price, preparation_time) VALUES
        (cat_platters, v_branch_id, 'Platter for 2', 1500, 30),
        (cat_platters, v_branch_id, 'Platter for 4', 4000, 35),
        (cat_platters, v_branch_id, 'Platter for 6', 6000, 40),
        (cat_platters, v_branch_id, 'Platter for 9', 9000, 45);

    RAISE NOTICE 'Bomet menu seeded successfully. Total categories: 11. Mbuzi prices set to 0 — update when confirmed.';

END $$;
