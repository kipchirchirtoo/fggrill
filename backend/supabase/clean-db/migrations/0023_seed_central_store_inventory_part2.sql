-- ============================================================
-- 0023_seed_central_store_inventory_part2.sql
-- Remaining items from the physical stock register:
--   WHISKY (tail), VODKA, SPIRITS, UDV, LIQUERS, WINES, SOFT DRINKS
-- ON CONFLICT (sku) DO UPDATE → idempotent / safe to re-run.
-- Opening stock intentionally ignored per user instruction.
-- ============================================================

INSERT INTO public.inventory_items
  (sku, item_name, description, category, store_type, default_unit_cost, reorder_description, unit, quantity, is_active)
VALUES

-- ── WHISKY (remaining) ────────────────────────────────────────
('316', 'NEDERBURG RED',          'NEDERBURG RED',          'WHISKY', 'bar_store', 1986.00, '5',   'pcs', 0, true),
('409', 'NEDERBURG WHITE',        'NEDERBURG WHITE',        'WHISKY', 'bar_store', 1609.00, '5',   'pcs', 0, true),
('220', 'RED BULL',               'RED BULL',               'WHISKY', 'bar_store',  181.00, '192', 'pcs', 0, true),
('318', 'ROBERTSON SWEET RED',    'ROBERTSON SWEET RED',    'WHISKY', 'bar_store', 1000.00, '10',  'pcs', 0, true),
('198', 'SAVANA CIDER',           'SAVANA CIDER',           'WHISKY', 'bar_store',  251.00, '96',  'pcs', 0, true),
('293', 'SOUTHERN COMFORT 750ML', 'SOUTHERN COMFORT 750ML', 'WHISKY', 'bar_store', 1800.00, '12',  'pcs', 0, true),
('403', 'VICEROY 10YRS',          'VICEROY 10YRS',          'WHISKY', 'bar_store', 3235.00, '2',   'pcs', 0, true),
('229', 'VICEROY 250ML',          'VICEROY 250ML',          'WHISKY', 'bar_store',  447.00, '168', 'pcs', 0, true),
('230', 'VICEROY 375ML',          'VICEROY 375ML',          'WHISKY', 'bar_store',  653.00, '420', 'pcs', 0, true),
('231', 'VICEROY 750ML',          'VICEROY 750ML',          'WHISKY', 'bar_store', 1260.00, '480', 'pcs', 0, true),
('395', 'WINDHOEK',               'WINDHOEK',               'WHISKY', 'bar_store',  190.00, NULL,  'pcs', 0, true),

-- ── VODKA ─────────────────────────────────────────────────────
('235', 'SCOTTISH LEADER 750ML',  'SCOTTISH LEADER 750ML',  'VODKA',  'bar_store', 1735.00, '8',   'pcs', 0, true),

-- ── SPIRITS ───────────────────────────────────────────────────
('239', 'KANE EXTRA 250ML',       'KANE EXTRA 250ML',       'SPIRITS', 'bar_store',  250.00, '10',  'pcs', 0, true),
('240', 'KANE EXTRA 750ML',       'KANE EXTRA 750ML',       'SPIRITS', 'bar_store',  750.00, '10',  'pcs', 0, true),

-- ── UDV ───────────────────────────────────────────────────────
('247', 'BLACK & WHITE 350ML',      'BLACK & WHITE 350ML',      'UDV', 'bar_store',  576.00, '72',  'pcs', 0, true),
('248', 'BLACK & WHITE 750ML',      'BLACK & WHITE 750ML',      'UDV', 'bar_store', 1120.00, '84',  'pcs', 0, true),
('410', 'BLACK AND WHITE 1LTR',     'BLACK AND WHITE 1LTR',     'UDV', 'bar_store', 1548.00, '50',  'pcs', 0, true),
('249', 'BOND 7 250ML',             'BOND 7 250ML',             'UDV', 'bar_store',  416.00, '40',  'pcs', 0, true),
('250', 'BOND 7 350ML',             'BOND 7 350ML',             'UDV', 'bar_store',  576.00, '72',  'pcs', 0, true),
('251', 'BOND 7 750ML',             'BOND 7 750ML',             'UDV', 'bar_store', 1240.00, '24',  'pcs', 0, true),
('379', 'CAPTAIN MORGAN 250ML',     'CAPTAIN MORGAN 250ML',     'UDV', 'bar_store',  336.00, '80',  'pcs', 0, true),
('380', 'CAPTAIN MORGAN 750ML',     'CAPTAIN MORGAN 750ML',     'UDV', 'bar_store',  920.00, '84',  'pcs', 0, true),
('253', 'CHIVAS REGAL 1LTR',        'CHIVAS REGAL 1LTR',        'UDV', 'bar_store', 4000.00, NULL,  'pcs', 0, true),
('252', 'CHIVAS REGAL 750ML',       'CHIVAS REGAL 750ML',       'UDV', 'bar_store', 3700.00, NULL,  'pcs', 0, true),
('254', 'DON JOLUO ANEJO',          'DON JOLUO ANEJO',          'UDV', 'bar_store', 7167.00, NULL,  'pcs', 0, true),
('255', 'DON JOLUO RPSDO',          'DON JOLUO RPSDO',          'UDV', 'bar_store', 5417.00, NULL,  'pcs', 0, true),
('256', 'DOUBLE BLACK 1LTR',        'DOUBLE BLACK 1LTR',        'UDV', 'bar_store', 5640.00, '12',  'pcs', 0, true),
('257', 'DOUBLE BLACK 750ML',       'DOUBLE BLACK 750ML',       'UDV', 'bar_store', 4160.00, '12',  'pcs', 0, true),
('221', 'GILBEYS 250ML',            'GILBEYS 250ML',            'UDV', 'bar_store',  416.00, '250', 'pcs', 0, true),
('222', 'GILBEYS 350ML',            'GILBEYS 350ML',            'UDV', 'bar_store',  576.00, '96',  'pcs', 0, true),
('223', 'GILBEYS 750ML',            'GILBEYS 750ML',            'UDV', 'bar_store', 1240.00, '72',  'pcs', 0, true),
('275', 'GREEN LABEL 1LTR',         'GREEN LABEL 1LTR',         'UDV', 'bar_store', 5500.00, NULL,  'pcs', 0, true),
('272', 'J D HONEY 1LTR',           'J D HONEY 1LTR',           'UDV', 'bar_store', 3500.00, NULL,  'pcs', 0, true),
('271', 'J D HONEY 750ML',          'J D HONEY 750ML',          'UDV', 'bar_store', 2500.00, NULL,  'pcs', 0, true),
('376', 'J W BLACK 1LTR',           'J W BLACK 1LTR',           'UDV', 'bar_store', 3911.00, '30',  'pcs', 0, true),
('377', 'J W BLACK 250ML',          'J W BLACK 250ML',          'UDV', 'bar_store', 1040.00, '15',  'pcs', 0, true),
('273', 'J W BLACK 375ML',          'J W BLACK 375ML',          'UDV', 'bar_store', 1720.00, '25',  'pcs', 0, true),
('274', 'J W BLACK 750ML',          'J W BLACK 750ML',          'UDV', 'bar_store', 3236.00, '35',  'pcs', 0, true),
('411', 'J W BLONDE',               'J W BLONDE',               'UDV', 'bar_store', 1991.00, '15',  'pcs', 0, true),
('279', 'J W GOLD RESERVE',         'J W GOLD RESERVE',         'UDV', 'bar_store', 7000.00, NULL,  'pcs', 0, true),
('276', 'J W RED 1LTR',             'J W RED 1LTR',             'UDV', 'bar_store', 2147.00, '60',  'pcs', 0, true),
('378', 'J W RED 250ML',            'J W RED 250ML',            'UDV', 'bar_store',  560.00, '12',  'pcs', 0, true),
('277', 'J W RED 375ML',            'J W RED 375ML',            'UDV', 'bar_store',  853.33, '24',  'pcs', 0, true),
('278', 'J W RED 750ML',            'J W RED 750ML',            'UDV', 'bar_store', 1799.00, '36',  'pcs', 0, true),
('241', 'JACK DANIELS HONEY 750ML', 'JACK DANIELS HONEY 750ML', 'UDV', 'bar_store', 3500.00, '8',   'pcs', 0, true),
('236', 'KC 250ML',                 'KC 250ML',                 'UDV', 'bar_store',  256.00, '400', 'pcs', 0, true),
('237', 'KC 350ML',                 'KC 350ML',                 'UDV', 'bar_store',  352.00, '72',  'pcs', 0, true),
('238', 'KC 750ML',                 'KC 750ML',                 'UDV', 'bar_store',  672.00, '360', 'pcs', 0, true),
('289', 'MARTINI BIANCO',           'MARTINI BIANCO',           'UDV', 'bar_store', 2200.00, NULL,  'pcs', 0, true),
('226', 'RICHOT 250ML',             'RICHOT 250ML',             'UDV', 'bar_store',  416.00, '80',  'pcs', 0, true),
('227', 'RICHOT 350ML',             'RICHOT 350ML',             'UDV', 'bar_store',  576.00, '96',  'pcs', 0, true),
('228', 'RICHOT 750ML',             'RICHOT 750ML',             'UDV', 'bar_store', 1240.00, '12',  'pcs', 0, true),
('319', 'SHERIDANS',                'SHERIDANS',                'UDV', 'bar_store', 4500.00, NULL,  'pcs', 0, true),
('290', 'SINGLETON 12 YRS',         'SINGLETON 12 YRS',         'UDV', 'bar_store', 5375.00, '3',   'pcs', 0, true),
('291', 'SINGLETON 15 YRS',         'SINGLETON 15 YRS',         'UDV', 'bar_store', 6500.00, '3',   'pcs', 0, true),
('292', 'SINGLETON 18 YRS',         'SINGLETON 18 YRS',         'UDV', 'bar_store', 8750.00, '3',   'pcs', 0, true),
('405', 'TANGUARAY 1LTR',           'TANGUARAY 1LTR',           'UDV', 'bar_store', 3167.00, NULL,  'pcs', 0, true),
('242', 'TANGUERAY 10YRS',          'TANGUERAY 10YRS',          'UDV', 'bar_store', 3200.00, NULL,  'pcs', 0, true),
('294', 'TANGUERAY 750ML',          'TANGUERAY 750ML',          'UDV', 'bar_store', 4250.00, NULL,  'pcs', 0, true),
('381', 'V & A 250ML',              'V & A 250ML',              'UDV', 'bar_store',  296.00, '40',  'pcs', 0, true),
('304', 'V & A 750ML',              'V & A 750ML',              'UDV', 'bar_store',  768.00, '36',  'pcs', 0, true),
('295', 'VAT 69 350ML',             'VAT 69 350ML',             'UDV', 'bar_store',  760.00, '72',  'pcs', 0, true),
('296', 'VAT 69 750ML',             'VAT 69 750ML',             'UDV', 'bar_store', 1400.00, '60',  'pcs', 0, true),
('232', 'VODKA 250ML',              'VODKA 250ML',              'UDV', 'bar_store',  416.00, '72',  'pcs', 0, true),
('233', 'VODKA 350ML',              'VODKA 350ML',              'UDV', 'bar_store',  576.00, '72',  'pcs', 0, true),
('234', 'VODKA 750ML',              'VODKA 750ML',              'UDV', 'bar_store', 1240.00, '60',  'pcs', 0, true),
('299', 'WILLIAM LAWSONS 1LTR',     'WILLIAM LAWSONS 1LTR',     'UDV', 'bar_store', 2229.00, '12',  'pcs', 0, true),
('297', 'WILLIAM LAWSONS 350ML',    'WILLIAM LAWSONS 350ML',    'UDV', 'bar_store',  869.00, '6',   'pcs', 0, true),
('298', 'WILLIAM LAWSONS 750ML',    'WILLIAM LAWSONS 750ML',    'UDV', 'bar_store', 1750.00, '12',  'pcs', 0, true),

-- ── LIQUERS ───────────────────────────────────────────────────
('302', 'BAILEYS 350ML',   'BAILEYS 350ML',   'LIQUERS', 'bar_store', 1200.00, '12',  'pcs', 0, true),
('303', 'BAILEYS 750ML',   'BAILEYS 750ML',   'LIQUERS', 'bar_store', 2160.00, '12',  'pcs', 0, true),
('244', 'BEST CREAM 750ML','BEST CREAM 750ML','LIQUERS', 'bar_store', 1089.00, '12',  'pcs', 0, true),

-- ── WINES ─────────────────────────────────────────────────────
('310', 'CHAMDOR',   'CHAMDOR',   'WINES', 'bar_store',  850.00, NULL,  'pcs', 0, true),
('313', 'FRONTERA',  'FRONTERA',  'WINES', 'bar_store', 1000.00, NULL,  'pcs', 0, true),
('317', 'PENASOL',   'PENASOL',   'WINES', 'bar_store',  850.00, NULL,  'pcs', 0, true),

-- ── SOFT DRINKS ───────────────────────────────────────────────
('420', 'SODA 300ML',          'SODA 300ML',          'SOFT DRINKS', 'bar_store',  31.00, NULL, 'pcs', 0, true),
('414', 'SODA CH',             'SODA CH',             'SOFT DRINKS', 'bar_store',   0.00, NULL, 'pcs', 0, true),
('419', 'SODA TAKE AWAY 500ML','SODA TAKE AWAY 500ML','SOFT DRINKS', 'bar_store',  60.00, NULL, 'pcs', 0, true),
('415', 'TAKE AWAY SODA',      'TAKE AWAY SODA',      'SOFT DRINKS', 'bar_store',   0.00, NULL, 'pcs', 0, true),
('421', 'WATER 10LTR',         'WATER 10LTR',         'SOFT DRINKS', 'bar_store',  86.00, NULL, 'pcs', 0, true),
('417', 'WATER 1LTR',          'WATER 1LTR',          'SOFT DRINKS', 'bar_store',  41.00, NULL, 'pcs', 0, true),
('418', 'WATER 500ML',         'WATER 500ML',         'SOFT DRINKS', 'bar_store',  21.00, NULL, 'pcs', 0, true)

ON CONFLICT (sku) DO UPDATE SET
  item_name           = EXCLUDED.item_name,
  description         = EXCLUDED.description,
  category            = EXCLUDED.category,
  store_type          = EXCLUDED.store_type,
  default_unit_cost   = EXCLUDED.default_unit_cost,
  reorder_description = EXCLUDED.reorder_description,
  unit                = EXCLUDED.unit,
  is_active           = true,
  last_updated        = NOW();
