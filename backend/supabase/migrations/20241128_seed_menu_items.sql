-- Seed Categories
INSERT INTO restaurant_menu_categories (name, sort_order, is_active) VALUES
('Breakfast', 1, true),
('Lunch', 2, true),
('Dinner', 3, true),
('Appetizers', 4, true),
('Soups', 5, true),
('Desserts', 6, true),
('Beverages', 7, true)
ON CONFLICT (name) DO NOTHING;

-- Seed Menu Items
WITH cat_breakfast AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Breakfast'),
     cat_lunch AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Lunch'),
     cat_dinner AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Dinner'),
     cat_appetizers AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Appetizers'),
     cat_soups AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Soups'),
     cat_desserts AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Desserts'),
     cat_beverages AS (SELECT id FROM restaurant_menu_categories WHERE name = 'Beverages')

INSERT INTO restaurant_menu_items (category_id, name, price, description, is_available) VALUES
((SELECT id FROM cat_breakfast), 'Full English Breakfast', 850, 'Eggs, bacon, sausage, beans, toast', true),
((SELECT id FROM cat_breakfast), 'Pancakes Stack', 550, 'Fluffy pancakes with syrup', true),
((SELECT id FROM cat_breakfast), 'Eggs Benedict', 750, 'Poached eggs on muffins with hollandaise', true),

((SELECT id FROM cat_lunch), 'Grilled Chicken Salad', 750, 'Fresh greens with grilled chicken breast', true),
((SELECT id FROM cat_lunch), 'Club Sandwich', 650, 'Triple decker sandwich with chicken and bacon', true),
((SELECT id FROM cat_lunch), 'Beef Burger', 850, 'Premium beef patty with cheese and fries', true),
((SELECT id FROM cat_lunch), 'Fish & Chips', 950, 'Battered fish fillet with tartar sauce', true),

((SELECT id FROM cat_dinner), 'Grilled Tilapia', 1200, 'Fresh lake tilapia served with ugali', true),
((SELECT id FROM cat_dinner), 'Beef Steak', 1800, 'Tender sirloin steak with pepper sauce', true),
((SELECT id FROM cat_dinner), 'Chicken Curry', 950, 'Spicy chicken curry with rice', true),
((SELECT id FROM cat_dinner), 'Lamb Chops', 1650, 'Grilled lamb chops with mint sauce', true),

((SELECT id FROM cat_appetizers), 'Chicken Wings', 550, 'Spicy buffalo wings', true),
((SELECT id FROM cat_appetizers), 'Spring Rolls', 350, 'Vegetable spring rolls', true),
((SELECT id FROM cat_appetizers), 'Samosas', 250, 'Beef or vegetable samosas pair', true),

((SELECT id FROM cat_soups), 'Tomato Soup', 350, 'Creamy tomato soup with croutons', true),

((SELECT id FROM cat_desserts), 'Chocolate Cake', 450, 'Rich moist chocolate cake', true),
((SELECT id FROM cat_desserts), 'Ice Cream', 300, 'Vanilla, chocolate or strawberry scoops', true),

((SELECT id FROM cat_beverages), 'Fresh Juice', 250, 'Freshly squeezed seasonal fruits', true),
((SELECT id FROM cat_beverages), 'Soft Drinks', 150, 'Soda (300ml)', true),
((SELECT id FROM cat_beverages), 'Tea/Coffee', 200, 'House tea or coffee', true),
((SELECT id FROM cat_beverages), 'Beer', 350, 'Local lager', true),
((SELECT id FROM cat_beverages), 'Wine (Glass)', 500, 'House red or white wine', true)
ON CONFLICT DO NOTHING;
