-- BAR MODULE SEED DATA - Kyogong
-- Drink prices in KES

-- Get category IDs
DO $$
DECLARE
  cat_beers UUID;
  cat_whisky UUID;
  cat_vodka UUID;
  cat_gin UUID;
  cat_rum UUID;
  cat_brandy UUID;
  cat_wines UUID;
  cat_cocktails UUID;
  cat_shooters UUID;
  cat_soft UUID;
BEGIN
  SELECT id INTO cat_beers FROM bar_drink_categories WHERE name = 'beers';
  SELECT id INTO cat_whisky FROM bar_drink_categories WHERE name = 'whisky';
  SELECT id INTO cat_vodka FROM bar_drink_categories WHERE name = 'vodka';
  SELECT id INTO cat_gin FROM bar_drink_categories WHERE name = 'gin';
  SELECT id INTO cat_rum FROM bar_drink_categories WHERE name = 'rum';
  SELECT id INTO cat_brandy FROM bar_drink_categories WHERE name = 'brandy';
  SELECT id INTO cat_wines FROM bar_drink_categories WHERE name = 'wines';
  SELECT id INTO cat_cocktails FROM bar_drink_categories WHERE name = 'cocktails';
  SELECT id INTO cat_shooters FROM bar_drink_categories WHERE name = 'shooters';
  SELECT id INTO cat_soft FROM bar_drink_categories WHERE name = 'soft-drinks';

  -- BEERS - Local
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_beers, 'Tusker Lager', 300, 'bottle'),
    (cat_beers, 'Tusker Malt', 350, 'bottle'),
    (cat_beers, 'White Cap Lager', 300, 'bottle'),
    (cat_beers, 'Pilsner Lager', 300, 'bottle'),
    (cat_beers, 'Guinness', 400, 'bottle'),
    (cat_beers, 'Senator Keg 500ml', 200, '500ml'),
    (cat_beers, 'Heineken', 450, 'bottle'),
    (cat_beers, 'Corona', 500, 'bottle'),
    (cat_beers, 'Budweiser', 450, 'bottle')
  ON CONFLICT DO NOTHING;

  -- WHISKY
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_whisky, 'Jameson (Shot)', 400, 'shot'),
    (cat_whisky, 'Jameson (Double)', 750, 'double'),
    (cat_whisky, 'Jack Daniels (Shot)', 450, 'shot'),
    (cat_whisky, 'Jack Daniels (Double)', 850, 'double'),
    (cat_whisky, 'Johnnie Walker Red (Shot)', 350, 'shot'),
    (cat_whisky, 'Johnnie Walker Black (Shot)', 550, 'shot'),
    (cat_whisky, 'Glenfiddich 12yr (Shot)', 800, 'shot'),
    (cat_whisky, 'Chivas Regal (Shot)', 600, 'shot')
  ON CONFLICT DO NOTHING;

  -- VODKA
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_vodka, 'Smirnoff (Shot)', 300, 'shot'),
    (cat_vodka, 'Smirnoff (Double)', 550, 'double'),
    (cat_vodka, 'Absolut (Shot)', 400, 'shot'),
    (cat_vodka, 'Grey Goose (Shot)', 700, 'shot'),
    (cat_vodka, 'Ciroc (Shot)', 650, 'shot')
  ON CONFLICT DO NOTHING;

  -- GIN
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_gin, 'Gordons Gin (Shot)', 300, 'shot'),
    (cat_gin, 'Tanqueray (Shot)', 450, 'shot'),
    (cat_gin, 'Bombay Sapphire (Shot)', 500, 'shot'),
    (cat_gin, 'Hendricks (Shot)', 650, 'shot')
  ON CONFLICT DO NOTHING;

  -- RUM
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_rum, 'Captain Morgan (Shot)', 350, 'shot'),
    (cat_rum, 'Bacardi White (Shot)', 350, 'shot'),
    (cat_rum, 'Bacardi Gold (Shot)', 400, 'shot'),
    (cat_rum, 'Malibu (Shot)', 400, 'shot')
  ON CONFLICT DO NOTHING;

  -- BRANDY
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_brandy, 'Viceroy (Shot)', 250, 'shot'),
    (cat_brandy, 'KWV 5yr (Shot)', 350, 'shot'),
    (cat_brandy, 'Hennessy VS (Shot)', 700, 'shot'),
    (cat_brandy, 'Remy Martin VSOP (Shot)', 900, 'shot')
  ON CONFLICT DO NOTHING;

  -- WINES
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_wines, 'House Red Wine (Glass)', 500, 'glass'),
    (cat_wines, 'House White Wine (Glass)', 500, 'glass'),
    (cat_wines, 'House Rose (Glass)', 500, 'glass'),
    (cat_wines, 'Red Wine (Bottle)', 2500, 'bottle'),
    (cat_wines, 'White Wine (Bottle)', 2500, 'bottle'),
    (cat_wines, 'Sparkling Wine (Bottle)', 3500, 'bottle')
  ON CONFLICT DO NOTHING;

  -- COCKTAILS
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_cocktails, 'Mojito', 650, 'glass'),
    (cat_cocktails, 'Margarita', 700, 'glass'),
    (cat_cocktails, 'Pina Colada', 700, 'glass'),
    (cat_cocktails, 'Long Island Iced Tea', 850, 'glass'),
    (cat_cocktails, 'Cosmopolitan', 700, 'glass'),
    (cat_cocktails, 'Mai Tai', 750, 'glass'),
    (cat_cocktails, 'Daiquiri', 650, 'glass'),
    (cat_cocktails, 'Sex on the Beach', 700, 'glass'),
    (cat_cocktails, 'Whisky Sour', 600, 'glass'),
    (cat_cocktails, 'Old Fashioned', 750, 'glass')
  ON CONFLICT DO NOTHING;

  -- SHOOTERS
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_shooters, 'Tequila Shot', 400, 'shot'),
    (cat_shooters, 'Jagermeister Shot', 450, 'shot'),
    (cat_shooters, 'B-52', 500, 'shot'),
    (cat_shooters, 'Sambuca Shot', 400, 'shot')
  ON CONFLICT DO NOTHING;

  -- SOFT DRINKS
  INSERT INTO bar_drinks (category_id, name, price, unit) VALUES
    (cat_soft, 'Coca Cola', 150, '300ml'),
    (cat_soft, 'Fanta Orange', 150, '300ml'),
    (cat_soft, 'Sprite', 150, '300ml'),
    (cat_soft, 'Tonic Water', 200, '300ml'),
    (cat_soft, 'Soda Water', 150, '300ml'),
    (cat_soft, 'Ginger Ale', 200, '300ml'),
    (cat_soft, 'Red Bull', 400, 'can'),
    (cat_soft, 'Mineral Water', 100, '500ml')
  ON CONFLICT DO NOTHING;

END$$;

SELECT 'Bar drinks seeded successfully - ' || COUNT(*) || ' drinks' AS status FROM bar_drinks;
