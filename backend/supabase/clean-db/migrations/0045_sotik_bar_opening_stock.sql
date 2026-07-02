-- ============================================================
-- 0045_sotik_bar_opening_stock.sql
-- Set real opening stock for Sotik (branch_id=4) Main Bar items,
-- from bar_stock_menu_final_260630_202347.pdf (handwritten TOTAL
-- column copied as opening stock; blanks set to 0 in the source).
-- Updates pos_outlet_items.opening_stock + current_stock by item
-- name within Sotik's Main Bar outlet (bar_drinks has no stock
-- column of its own; pos_outlet_items is what the POS reads).
-- Idempotent: re-running sets the same values again.
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
BEGIN
  SELECT id INTO v_outlet_id
  FROM public.pos_outlets
  WHERE branch_id = 4 AND outlet_type = 'main_bar'
  LIMIT 1;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'No main_bar outlet found for branch_id=4';
  END IF;

  UPDATE public.pos_outlet_items poi
  SET opening_stock = v.qty,
      current_stock = v.qty,
      updated_at = NOW()
  FROM (VALUES
    ('Viceroy 1/4', 10), ('Viceroy 1/2', 13), ('Viceroy 750 ml', 17), ('Robertson', 0),
    ('Viceroy 10 Yrs', 0), ('Richot 1/4', 8), ('Richot 1/2', 8), ('Richot 750 ml', 8),
    ('Vodka 250 ml', 7), ('Vodka 350 ml', 8), ('Vodka 750 ml', 5),
    ('K.C 250 ml', 28), ('K.C 350 ml', 7), ('K.C 750 ml', 20), ('Popov 250 ml', 0),
    ('Jameson 1/2', 2), ('Jameson 750 ml', 2), ('VAT 69 1/2', 7), ('VAT 69 750 ml', 6),
    ('J.W Red 250 ml', 0), ('J.W Red 375 ml', 2), ('J.W Red 750 ml', 4), ('J.W Red 1 Ltr', 4),
    ('J.W Black 1/2', 2), ('J.W Black 250 ml', 0), ('J.W Black 750 ml', 3),
    ('J.W Blonde 750 ml', 2), ('J.W Black 1 Ltr', 3), ('J.W Black Green Label 1 L', 0),
    ('Bond 7 1/4', 5), ('Bond 7 1/2', 5), ('Bond 7 3/4', 4),
    ('Best Whisky 1/4', 0), ('Best Whisky 3/4', 5), ('Famous Grouse 3/4', 2),
    ('Glenfiddich 12 Yrs', 0), ('Glenfiddich 15 Yrs', 0),
    ('Hennessy', 2), ('Hennessy VSOP', 0), ('Martell', 1), ('Martell VSOP', 2),
    ('Jack Daniels 350 ml', 2), ('Jack Daniels 750 ml', 2), ('Jack Daniels 1 Ltr', 0),
    ('Double Black 750 ml', 0), ('Double Black 1 Ltr', 0), ('All Seasons 3/4', 8),
    ('William Lawsons 3/4', 2), ('William Lawsons 1 Ltr', 1),
    ('Grants 1/2', 2), ('Grants 3/4', 6), ('Grants 1 Ltr', 2),
    ('Black & White 1/2', 6), ('Black & White 3/4', 0),
    ('Hunters 1/4', 5), ('Hunters 1/2', 5), ('Hunters 3/4', 6),
    ('J&B 750 ml', 0), ('Singleton 12 Yrs', 2), ('Singleton 15 Yrs', 0), ('Tang 10', 0),
    ('Amarula 1/2', 2), ('Amarula 750 ml', 2), ('Best Cream', 3),
    ('Baileys 1/2', 1), ('Baileys 750 ml', 0), ('V&A 1/4', 5), ('V&A 750 ml', 2),
    ('4th Street', 3), ('Cellar Cask', 2), ('Drostdy-Hof', 1), ('Chamdor 3/4', 0),
    ('Caprice Pkt', 6), ('Four Cousins', 0), ('Asconi', 0), ('Asconi 750 ml', 3),
    ('Casabuena 1 Ltr', 4), ('Jager', 0), ('Camino', 0), ('Jager Tot', 35), ('Camino Tot', 8),
    ('Captain Morgan 3/4', 9), ('Captain Morgan 1/4', 7),
    ('Trust Studded', 29), ('Trust Kiss', 0), ('Trust Classic', 0),
    ('Soda 300 ml', 0), ('Soda 500 ml', 222), ('Coke Zero', 0), ('Novida', 0),
    ('Dasani 1/2', 33), ('Dasani 1 Ltr', 199), ('Minute Maid', 2), ('Predator', 36),
    ('Monster', 4), ('Tonic Soda', 0), ('Lime Lemonade', 10), ('Hunters Gold 250 ml', 9),
    ('Manyatta', 64), ('Tusker Cider', 87), ('Guinness', 91), ('Snapp', 25),
    ('Tusker Lager', 85), ('Tusker Lite', 35), ('Tusker Malt', 0), ('Pilsner Lager', 38),
    ('White Cap Lager', 83), ('B. Ice', 40), ('Balozi', 54), ('Guarana', 89),
    ('Guinness Can', 11), ('Tusker Cider Can', 17), ('Tusker Lager Can', 7),
    ('White Cap Can', 15), ('Tusker Lite Can', 12), ('Tusker Malt Can', 6),
    ('Pilsner Can', 0), ('Balozi Can', 8), ('Snapp Can', 10), ('Manyatta Can', 17), ('Faxe', 5),
    ('Heineken', 12), ('Desperado', 0), ('Alvaro', 13), ('Savanna Cider', 14),
    ('Kingfisher', 12), ('Red Bull', 11), ('Delmonte', 19), ('Windhoek', 0),
    ('Gilbeys Gin 1/4', 8), ('Gilbeys Gin 1/2', 8), ('Gilbeys Gin 750 ml', 8),
    ('Gordons Dry Gin 1/2', 5), ('Gordons Dry Gin 750 ml', 4)
  ) AS v(name, qty)
  WHERE poi.outlet_id = v_outlet_id
    AND poi.name = v.name;

  RAISE NOTICE 'Updated opening stock for % items in Sotik Main Bar (outlet %)',
    (SELECT COUNT(*) FROM public.pos_outlet_items WHERE outlet_id = v_outlet_id AND opening_stock > 0),
    v_outlet_id;
END $$;
