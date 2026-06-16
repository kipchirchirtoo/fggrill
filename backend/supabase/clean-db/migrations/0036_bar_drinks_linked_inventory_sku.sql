-- ============================================================
-- 0036_bar_drinks_linked_inventory_sku.sql
-- Adds linked_inventory_sku column to bar_drinks and fills in
-- the name-matched inventory_items.sku for each bar_drink.
-- This lets the POS Outlet Issue screen pre-suggest the correct
-- branch stock source when the storekeeper tops up bar stock.
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE by SKU.
-- ============================================================

ALTER TABLE public.bar_drinks
  ADD COLUMN IF NOT EXISTS linked_inventory_sku TEXT;

-- ── SOFT DRINKS ───────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '419' WHERE sku = 'FGB-SDR-0001'; -- Soda 500ml  → SODA TAKE AWAY 500ML
UPDATE public.bar_drinks SET linked_inventory_sku = '417' WHERE sku = 'FGB-SDR-0002'; -- H2O 1L      → WATER 1LTR
-- FGB-SDR-0003 Alvaro Can   : no central stock equivalent
UPDATE public.bar_drinks SET linked_inventory_sku = '328' WHERE sku = 'FGB-SDR-0004'; -- Delmonte     → DELMONTE
UPDATE public.bar_drinks SET linked_inventory_sku = '333' WHERE sku = 'FGB-SDR-0005'; -- Lemonade     → LEMONADE

-- ── BEERS ─────────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '203' WHERE sku = 'FGB-BER-0001'; -- T. Larger    → TUSKER LAGER
UPDATE public.bar_drinks SET linked_inventory_sku = '202' WHERE sku = 'FGB-BER-0002'; -- T. Cider     → TUSKER CIDER
UPDATE public.bar_drinks SET linked_inventory_sku = '204' WHERE sku = 'FGB-BER-0003'; -- T. Lite      → TUSKER LITE
UPDATE public.bar_drinks SET linked_inventory_sku = '205' WHERE sku = 'FGB-BER-0004'; -- T. Malt      → TUSKER MALT
UPDATE public.bar_drinks SET linked_inventory_sku = '193' WHERE sku = 'FGB-BER-0005'; -- Guiness      → GUINNESS
UPDATE public.bar_drinks SET linked_inventory_sku = '190' WHERE sku = 'FGB-BER-0006'; -- Balozi       → BALOZI
UPDATE public.bar_drinks SET linked_inventory_sku = '191' WHERE sku = 'FGB-BER-0007'; -- Black Ice    → BLACK ICE
UPDATE public.bar_drinks SET linked_inventory_sku = '200' WHERE sku = 'FGB-BER-0008'; -- Snapp        → SNAPP
UPDATE public.bar_drinks SET linked_inventory_sku = '197' WHERE sku = 'FGB-BER-0009'; -- Pilsner      → PILSNER LAGER
UPDATE public.bar_drinks SET linked_inventory_sku = '196' WHERE sku = 'FGB-BER-0010'; -- Manyatta     → MANYATTA
UPDATE public.bar_drinks SET linked_inventory_sku = '192' WHERE sku = 'FGB-BER-0011'; -- Desparado    → DESPARADO
UPDATE public.bar_drinks SET linked_inventory_sku = '195' WHERE sku = 'FGB-BER-0012'; -- Hunters Beer → HUNTERS CIDER GOLD
UPDATE public.bar_drinks SET linked_inventory_sku = '206' WHERE sku = 'FGB-BER-0013'; -- White Cap    → WHITE CAP LAGER

-- ── CANNED BEERS ──────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '211' WHERE sku = 'FGB-CAN-0001'; -- Guiness Can    → GUINNESS CAN
UPDATE public.bar_drinks SET linked_inventory_sku = '215' WHERE sku = 'FGB-CAN-0002'; -- T. Can         → TUSKER LAGER CAN
UPDATE public.bar_drinks SET linked_inventory_sku = '218' WHERE sku = 'FGB-CAN-0003'; -- W. Cap Can     → WHITE CAP CAN
UPDATE public.bar_drinks SET linked_inventory_sku = '209' WHERE sku = 'FGB-CAN-0004'; -- Black Ice Can  → BLACK ICE CAN
-- FGB-CAN-0005 Guarana        : no central stock equivalent
UPDATE public.bar_drinks SET linked_inventory_sku = '216' WHERE sku = 'FGB-CAN-0006'; -- T. Lite Can    → TUSKER LITE CAN
UPDATE public.bar_drinks SET linked_inventory_sku = '214' WHERE sku = 'FGB-CAN-0007'; -- T. Cider Can   → TUSKER CIDER CAN
-- FGB-CAN-0008 Manyatta Can   : no central stock equivalent (bottle only)
UPDATE public.bar_drinks SET linked_inventory_sku = '213' WHERE sku = 'FGB-CAN-0009'; -- Snapp Can      → SNAPP CAN
-- FGB-CAN-0010 Quarana Punch  : no central stock equivalent
-- FGB-CAN-0011 S/Raspberry Twist : no central stock equivalent
-- FGB-CAN-0012 Gordons Can    : stocked as bottle (use 314 GORDONS 750ML as proxy)
UPDATE public.bar_drinks SET linked_inventory_sku = '314' WHERE sku = 'FGB-CAN-0012'; -- Gordons Can → GORDONS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '210' WHERE sku = 'FGB-CAN-0013'; -- Faxe Can       → FAXE CAN
UPDATE public.bar_drinks SET linked_inventory_sku = '208' WHERE sku = 'FGB-CAN-0014'; -- Balozi Can     → BALOZI CAN

-- ── SPIRITS ───────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '236' WHERE sku = 'FGB-SPR-0001'; -- KC 1/4     → KC 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '237' WHERE sku = 'FGB-SPR-0002'; -- KC 1/2     → KC 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '238' WHERE sku = 'FGB-SPR-0003'; -- KC 3/4     → KC 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '232' WHERE sku = 'FGB-SPR-0004'; -- Vodka 1/4  → VODKA 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '233' WHERE sku = 'FGB-SPR-0005'; -- Vodka 1/2  → VODKA 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '234' WHERE sku = 'FGB-SPR-0006'; -- Vodka 3/4  → VODKA 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '226' WHERE sku = 'FGB-SPR-0007'; -- Richot 1/4 → RICHOT 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '227' WHERE sku = 'FGB-SPR-0008'; -- Richot 1/2 → RICHOT 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '228' WHERE sku = 'FGB-SPR-0009'; -- Richot 3/4 → RICHOT 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '221' WHERE sku = 'FGB-SPR-0010'; -- Gilbeys 1/4 → GILBEYS 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '222' WHERE sku = 'FGB-SPR-0011'; -- Gilbeys 1/2 → GILBEYS 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '223' WHERE sku = 'FGB-SPR-0012'; -- Gilbeys 3/4 → GILBEYS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '229' WHERE sku = 'FGB-SPR-0013'; -- Viceroy 1/4 → VICEROY 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '230' WHERE sku = 'FGB-SPR-0014'; -- Viceroy 1/2 → VICEROY 375ML
UPDATE public.bar_drinks SET linked_inventory_sku = '231' WHERE sku = 'FGB-SPR-0015'; -- Viceroy 3/4 → VICEROY 750ML

-- ── WHISKY ────────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '245' WHERE sku = 'FGB-WHK-0001'; -- B/Whisky 3/4          → BEST WHISKY 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '244' WHERE sku = 'FGB-WHK-0002'; -- B/Cream 750ml         → BEST CREAM 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '243' WHERE sku = 'FGB-WHK-0003'; -- All Seasons 3/4       → ALL SEASONS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '295' WHERE sku = 'FGB-WHK-0004'; -- VAT 69 1/2            → VAT 69 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '296' WHERE sku = 'FGB-WHK-0005'; -- VAT 69 3/4            → VAT 69 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '249' WHERE sku = 'FGB-WHK-0006'; -- Bond 7 1/4            → BOND 7 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '250' WHERE sku = 'FGB-WHK-0007'; -- Bond 7 1/2            → BOND 7 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '251' WHERE sku = 'FGB-WHK-0008'; -- Bond 7 3/4            → BOND 7 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '265' WHERE sku = 'FGB-WHK-0009'; -- Grants 3/4            → GRANTS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '263' WHERE sku = 'FGB-WHK-0010'; -- Grants 1L             → GRANTS 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '378' WHERE sku = 'FGB-WHK-0011'; -- Red Label 1/4         → J W RED 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '277' WHERE sku = 'FGB-WHK-0012'; -- Red Label 1/2         → J W RED 375ML
UPDATE public.bar_drinks SET linked_inventory_sku = '278' WHERE sku = 'FGB-WHK-0013'; -- Red Label 3/4         → J W RED 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '276' WHERE sku = 'FGB-WHK-0014'; -- Red Label 1L          → J W RED 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '273' WHERE sku = 'FGB-WHK-0015'; -- Black Label 1/2       → J W BLACK 375ML
UPDATE public.bar_drinks SET linked_inventory_sku = '274' WHERE sku = 'FGB-WHK-0016'; -- Black Label 3/4       → J W BLACK 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '376' WHERE sku = 'FGB-WHK-0017'; -- Black Label 1L        → J W BLACK 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '411' WHERE sku = 'FGB-WHK-0018'; -- JW Blonde             → J W BLONDE
UPDATE public.bar_drinks SET linked_inventory_sku = '268' WHERE sku = 'FGB-WHK-0019'; -- Hunters 1/4           → HUNTERS CHOICE 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '269' WHERE sku = 'FGB-WHK-0020'; -- Hunters 1/2           → HUNTERS CHOICE 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '270' WHERE sku = 'FGB-WHK-0021'; -- Hunters 3/4           → HUNTERS CHOICE 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '247' WHERE sku = 'FGB-WHK-0022'; -- B&S 1/2               → BLACK & WHITE 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '248' WHERE sku = 'FGB-WHK-0023'; -- B&S 3/4               → BLACK & WHITE 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '198' WHERE sku = 'FGB-WHK-0024'; -- Savanna               → SAVANA CIDER
UPDATE public.bar_drinks SET linked_inventory_sku = '242' WHERE sku = 'FGB-WHK-0025'; -- Tang 10               → TANGUERAY 10YRS
UPDATE public.bar_drinks SET linked_inventory_sku = '225' WHERE sku = 'FGB-WHK-0026'; -- Gordons 1/2           → GORDONS 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '314' WHERE sku = 'FGB-WHK-0027'; -- Gordons 3/4           → GORDONS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '280' WHERE sku = 'FGB-WHK-0028'; -- JD 1/2                → JACK DANIELS 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '281' WHERE sku = 'FGB-WHK-0029'; -- JD 3/4                → JACK DANIELS 700ML
UPDATE public.bar_drinks SET linked_inventory_sku = '282' WHERE sku = 'FGB-WHK-0030'; -- JD 1L                 → JACK DANIELS 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '283' WHERE sku = 'FGB-WHK-0031'; -- Jameson 1/2           → JAMESON 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '284' WHERE sku = 'FGB-WHK-0032'; -- Jameson 3/4           → JAMESON 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '285' WHERE sku = 'FGB-WHK-0033'; -- Jameson 1L            → JAMESON 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '379' WHERE sku = 'FGB-WHK-0034'; -- Captain Morgan 1/4    → CAPTAIN MORGAN 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '380' WHERE sku = 'FGB-WHK-0035'; -- Captain Morgan 3/4    → CAPTAIN MORGAN 750ML
-- FGB-WHK-0036 Captain Morgan Melon : no central stock equivalent
UPDATE public.bar_drinks SET linked_inventory_sku = '259' WHERE sku = 'FGB-WHK-0037'; -- Famous Grouse         → FAMOUS GROUSE 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '297' WHERE sku = 'FGB-WHK-0038'; -- William Lawsons 1/2   → WILLIAM LAWSONS 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '298' WHERE sku = 'FGB-WHK-0039'; -- William Lawsons 3/4   → WILLIAM LAWSONS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '299' WHERE sku = 'FGB-WHK-0040'; -- William Lawsons 1L    → WILLIAM LAWSONS 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '381' WHERE sku = 'FGB-WHK-0041'; -- V&A 1/4               → V & A 250ML
UPDATE public.bar_drinks SET linked_inventory_sku = '304' WHERE sku = 'FGB-WHK-0042'; -- V&A 3/4               → V & A 750ML

-- ── WINES ─────────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '306-2' WHERE sku = 'FGB-WIN-0001'; -- Cellar Cask   → CELLAR CASK
UPDATE public.bar_drinks SET linked_inventory_sku = '194'   WHERE sku = 'FGB-WIN-0002'; -- Heineken      → HEINEKEN
UPDATE public.bar_drinks SET linked_inventory_sku = '305'   WHERE sku = 'FGB-WIN-0003'; -- 4th Street    → 4TH STREET SWEET RED
UPDATE public.bar_drinks SET linked_inventory_sku = '323'   WHERE sku = 'FGB-WIN-0004'; -- Casabuena     → CASABUENA SANGRIA RED
UPDATE public.bar_drinks SET linked_inventory_sku = '308'   WHERE sku = 'FGB-WIN-0005'; -- Caprice       → CAPRICE SWEET RED
UPDATE public.bar_drinks SET linked_inventory_sku = '312'   WHERE sku = 'FGB-WIN-0006'; -- Four Cousins  → FOUR COUSINS RED
UPDATE public.bar_drinks SET linked_inventory_sku = '315'   WHERE sku = 'FGB-WIN-0007'; -- Kingfisher    → KINGFISHER
UPDATE public.bar_drinks SET linked_inventory_sku = '300'   WHERE sku = 'FGB-WIN-0008'; -- Amarula 1/2   → AMARULA CREAM 375ML
UPDATE public.bar_drinks SET linked_inventory_sku = '301'   WHERE sku = 'FGB-WIN-0009'; -- Amarula 3/4   → AMARULA CREAM 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '302'   WHERE sku = 'FGB-WIN-0010'; -- Baileys 1/2   → BAILEYS 350ML
UPDATE public.bar_drinks SET linked_inventory_sku = '303'   WHERE sku = 'FGB-WIN-0011'; -- Baileys 3/4   → BAILEYS 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '307'   WHERE sku = 'FGB-WIN-0012'; -- Asconi        → ASCONI
UPDATE public.bar_drinks SET linked_inventory_sku = '311'   WHERE sku = 'FGB-WIN-0013'; -- Drotdy        → DROSDTY HOF CLARET
UPDATE public.bar_drinks SET linked_inventory_sku = '318'   WHERE sku = 'FGB-WIN-0014'; -- Robertson     → ROBERTSON SWEET RED

-- ── COGNAC ────────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '402' WHERE sku = 'FGB-COG-0001'; -- Hennessy 750ml  → HENNESY
UPDATE public.bar_drinks SET linked_inventory_sku = '256' WHERE sku = 'FGB-COG-0002'; -- Double Black 1L → DOUBLE BLACK 1LTR
UPDATE public.bar_drinks SET linked_inventory_sku = '287' WHERE sku = 'FGB-COG-0003'; -- Martel VS       → MARTEL VS 700ML
UPDATE public.bar_drinks SET linked_inventory_sku = '288' WHERE sku = 'FGB-COG-0004'; -- Martel VSOP     → MARTEL VSOP 700ML
UPDATE public.bar_drinks SET linked_inventory_sku = '290' WHERE sku = 'FGB-COG-0005'; -- Singletone 12YRS → SINGLETON 12 YRS

-- ── ENERGY DRINKS ─────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '220' WHERE sku = 'FGB-ENR-0001'; -- Redbull → RED BULL
UPDATE public.bar_drinks SET linked_inventory_sku = '219' WHERE sku = 'FGB-ENR-0002'; -- Monster → MONSTER

-- ── OTHERS ────────────────────────────────────────────────────
UPDATE public.bar_drinks SET linked_inventory_sku = '334' WHERE sku = 'FGB-OTH-0001'; -- Camino       → CAMINO BLANCO 750ML
UPDATE public.bar_drinks SET linked_inventory_sku = '337' WHERE sku = 'FGB-OTH-0002'; -- Jagermeister → JAGERMEISTER 700ML
UPDATE public.bar_drinks SET linked_inventory_sku = '319' WHERE sku = 'FGB-OTH-0003'; -- Sheridans    → SHERIDANS
-- FGB-OTH-0004 Bullet Bourbon : no central stock equivalent
-- FGB-OTH-0005 Trust Classic  : consumable, not tracked as bar_store stock
-- FGB-OTH-0006 Trust Studded  : consumable, not tracked as bar_store stock
-- FGB-OTH-0007 Pool Tokens    : token/service, not a stocked item
