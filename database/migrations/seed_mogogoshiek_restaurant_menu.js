/**
 * SEED SCRIPT: MOGOGOSHIEK POS Menu Items (Restaurant + Main Bar)
 * Branch: MOGOGOSHIEK (Branch ID: 5)
 * Restaurant Outlet ID: b9213487-c2d7-4f47-9fca-0794abcccda5
 * Main Bar Outlet ID:   be5564a1-35e7-4e25-9d1b-cd201383a522
 * Table: restaurant_menu_items
 *
 * Routing:
 *   Food/hot beverages/cold beverages → Restaurant POS
 *   Alcohol/soft drinks/energy drinks/beer/spirits → Main Bar POS
 *
 * Source: rptitemspricelist.pdf - FG Grill Mogogosiek Items Menu Price List
 *
 * Run: node database/migrations/seed_mogogoshiek_restaurant_menu.js
 */

const https = require('https');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://rvoaowhxyweswwuxbrzm.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns';

const BRANCH_ID = 5;
const BRANCH_NAME = 'MOGOGOSHIEK';
const RESTAURANT_OUTLET_ID = 'b9213487-c2d7-4f47-9fca-0794abcccda5';
const MAIN_BAR_OUTLET_ID   = 'be5564a1-35e7-4e25-9d1b-cd201383a522';

// Categories that belong to the Main Bar POS outlet
const BAR_CATEGORIES = new Set([
  'SOFT DRINKS',
  'ENERGY DRINKS',
  'BOTTLED BEER',
  'CANNED BEERS',
  'GIN',
  'WINES',
  'BRANDY',
  'VODKA',
  'SPIRITS',
  'WHISKY',
  'RUM & LIQUOR',
  'TOTS',
]);

// ─── FULL MENU DATA (parsed from PDF) ─────────────────────────────────────────
// Format: [code, name, price, category]
const MENU_ITEMS = [
  // ── HOT BEVERAGES ──────────────────────────────────────────────────────────
  [286, 'BLACK COFFEE',                   70,      'HOT BEVERAGES'],
  [10,  'BLACK COFFEE FLASK (SMALL)',      150,     'HOT BEVERAGES'],
  [8,   'BLACK COFFEE MUG',               50,      'HOT BEVERAGES'],
  [284, 'BLACK TEA MEDIUM',               150,     'HOT BEVERAGES'],
  [282, 'BLACK TEA MUG',                  50,      'HOT BEVERAGES'],
  [283, 'BLACK TEA SMALL FLASK',          100,     'HOT BEVERAGES'],
  [14,  'DAWA',                           100,     'HOT BEVERAGES'],
  [7,   'GINGER TEA',                     100,     'HOT BEVERAGES'],
  [13,  'LEMON TEA BIG MUG',              100,     'HOT BEVERAGES'],
  [15,  'PORRIDGE',                       100,     'HOT BEVERAGES'],
  [6,   'SPECIAL TEA FLASK (SMALL)',      150,     'HOT BEVERAGES'],
  [288, 'SPECIAL TEA MEDIUM',             300,     'HOT BEVERAGES'],
  [4,   'TEA FLASK LARGE',                300,     'HOT BEVERAGES'],
  [3,   'TEA FLASK MEDIUM',               200,     'HOT BEVERAGES'],
  [2,   'TEA FLASK SMALL',                100,     'HOT BEVERAGES'],
  [5,   'TEA MASALA/GINGER (LARGE)',       450,     'HOT BEVERAGES'],
  [1,   'TEA MUG',                        40,      'HOT BEVERAGES'],
  [12,  'WHITE CHOCOLATE/MILO MUG',       70,      'HOT BEVERAGES'],
  [11,  'WHITE COFFEE FLASK SMALL',       150,     'HOT BEVERAGES'],
  [9,   'WHITE COFFEE MUG',               70,      'HOT BEVERAGES'],
  [285, 'WHITE TEA MUG',                  50,      'HOT BEVERAGES'],

  // ── COLD BEVERAGES ─────────────────────────────────────────────────────────
  [18,  'COCKTAIL JUICE',                 150,     'COLD BEVERAGES'],
  [16,  'FRESH MILK GLASS',               100,     'COLD BEVERAGES'],
  [250, 'KERINGET 1/2 LTR',               70,      'COLD BEVERAGES'],
  [251, 'KERINGET 1 LTR',                 120,     'COLD BEVERAGES'],
  [242, 'MALA',                           50,      'COLD BEVERAGES'],
  [17,  'MANGO JUICE',                    150,     'COLD BEVERAGES'],
  [253, 'MILK PACKET',                    100,     'COLD BEVERAGES'],
  [22,  'MILK SHAKE (SMOOTHIE)',           200,     'COLD BEVERAGES'],
  [21,  'MILK SHAKE (STRAWBERRY)',         200,     'COLD BEVERAGES'],
  [20,  'MILK SHAKE (VANILLA)',            200,     'COLD BEVERAGES'],
  [248, 'MINERAL WATER 1/2 LTR',          50,      'COLD BEVERAGES'],
  [249, 'MINERAL WATER 1 LTR',            100,     'COLD BEVERAGES'],
  [19,  'PINEAPPLE JUICE',                150,     'COLD BEVERAGES'],
  [252, 'SODA (300ML)',                   70,      'COLD BEVERAGES'],
  [280, 'STAFF GLASS MILK',               50,      'COLD BEVERAGES'],

  // ── MUTTON ─────────────────────────────────────────────────────────────────
  [245, '1/2 MBUZI CHOMA',               600,     'MUTTON'],
  [104, '1/2 MBUZI WET FRY',             800,     'MUTTON'],
  [254, '1/4 LIVER PAN FRY',             300,     'MUTTON'],
  [255, '1/4 LIVER WET FRY',             300,     'MUTTON'],
  [275, '1/4 MBUZI BOILED',              400,     'MUTTON'],
  [244, '1/4 MBUZI CHOMA',               300,     'MUTTON'],
  [103, '1/4 MBUZI WET FRY',             350,     'MUTTON'],
  [247, '1KG MBUZI CHOMA',               1200,    'MUTTON'],
  [105, '1KG MBUZI WET FRY',             1400,    'MUTTON'],
  [246, '3/4 MBUZI CHOMA',               900,     'MUTTON'],
  [375, 'MBUZI TUMBUKIZA',               1200,    'MUTTON'],
  [277, 'PAN FRY MBUZI 1/2',             800,     'MUTTON'],
  [287, 'PAN FRY MBUZI 1KG',             1400,    'MUTTON'],
  [276, 'PAN FRY MBUZI 1/4',             400,     'MUTTON'],

  // ── BEEF ───────────────────────────────────────────────────────────────────
  [111, '1 KG BEEF CHOMA',               1400,    'BEEF'],
  [109, '1/2 BEEF BOILED',               650,     'BEEF'],
  [108, '1/2 BEEF CHOMA',                650,     'BEEF'],
  [114, '1/2 BEEF WET FRY',              800,     'BEEF'],
  [107, '1/4 BEEF BOILED',               350,     'BEEF'],
  [106, '1/4 BEEF CHOMA',                350,     'BEEF'],
  [113, '1/4 BEEF WET FRY',              400,     'BEEF'],
  [112, '1KG BEEF BOILED',               1500,    'BEEF'],
  [115, '1KG BEEF WET FRY',              1500,    'BEEF'],
  [110, '3/4 BEEF CHOMA',                850,     'BEEF'],
  [259, 'MATUMBO',                       350,     'BEEF'],
  [279, 'PAN FRY BEEF 1/2',              850,     'BEEF'],
  [278, 'PAN FRY BEEF 1/4',              450,     'BEEF'],
  [430, 'TUMBUKIZA 1/2',                 900,     'BEEF'],

  // ── CHICKEN BROILERS ───────────────────────────────────────────────────────
  [88,  '1/2 CHOMA CHICKEN BROILER',     800,     'CHICKEN BROILERS'],
  [85,  '1/2 DRY FRY CHICKEN BROILER',  700,     'CHICKEN BROILERS'],
  [87,  '1/2 PAN FRY CHICKEN BROILER',  800,     'CHICKEN BROILERS'],
  [86,  '1/2 WET FRY CHICKEN BROILER',  800,     'CHICKEN BROILERS'],
  [92,  '1/4 CHICKEN CURRY',            500,     'CHICKEN BROILERS'],
  [81,  '1/4 CHICKEN DRY FRY BROILER',  350,     'CHICKEN BROILERS'],
  [93,  '1/4 CHICKEN MERRYLAND',        500,     'CHICKEN BROILERS'],
  [84,  '1/4 CHOMA CHICKEN BROILER',    350,     'CHICKEN BROILERS'],
  [82,  '1/4 WET FRY CHICKEN BROILER',  400,     'CHICKEN BROILERS'],
  [256, 'BROILER PAN FRY 1/4',          400,     'CHICKEN BROILERS'],
  [94,  'CHICKEN MASALA',               500,     'CHICKEN BROILERS'],
  [314, 'CHICKEN SPECIAL BROILER',      400,     'CHICKEN BROILERS'],
  [89,  'FULL CHICKEN BROILER WET FRY', 1500,    'CHICKEN BROILERS'],
  [91,  'FULL CHICKEN DRY FRY BROILER', 1400,    'CHICKEN BROILERS'],
  [90,  'FULL CHICKEN PAN FRY BROILER', 1500,    'CHICKEN BROILERS'],

  // ── SNACKS ─────────────────────────────────────────────────────────────────
  [54,  'BHAJIA',                        200,     'SNACKS'],
  [320, 'BREAD ROLL 2PCS',               50,      'SNACKS'],
  [423, 'BREAKFAST',                     500,     'SNACKS'],
  [25,  'CHAPATI (BROWN)',               70,      'SNACKS'],
  [24,  'CHAPATI (WHITE)',               50,      'SNACKS'],
  [34,  'CHAPATI ROLL',                  150,     'SNACKS'],
  [38,  'CHICKEN SANDWICH',              250,     'SNACKS'],
  [318, 'COOKIES 2PCS',                  50,      'SNACKS'],
  [42,  'CORN FLAKES',                   50,      'SNACKS'],
  [27,  'DOUGHNUT',                      50,      'SNACKS'],
  [31,  'KEBAB',                         80,      'SNACKS'],
  [40,  'KEBAB SPECIAL',                 150,     'SNACKS'],
  [26,  'MAHAMRI',                       50,      'SNACKS'],
  [23,  'MANDAZI (3PCS)',                50,      'SNACKS'],
  [315, 'MARBLE CAKE',                   100,     'SNACKS'],
  [33,  'MAYAI FRIED (KIENYEJI)',        150,     'SNACKS'],
  [30,  'PANCAKE (1 PAIR)',              100,     'SNACKS'],
  [28,  'SAMOSA',                        50,      'SNACKS'],
  [29,  'SAUSAGE',                       60,      'SNACKS'],
  [319, 'SCONES 2PCS',                   50,      'SNACKS'],
  [317, 'SMOKIES',                       60,      'SNACKS'],
  [37,  'SPANISH OMELETTE (BROILER)',    150,     'SNACKS'],
  [270, 'SPANISH OMELETTE (KIENYEJI)',  200,     'SNACKS'],
  [406, 'TEA AND SNACKS',               100,     'SNACKS'],
  [316, 'TEA SCONE',                     50,      'SNACKS'],

  // ── CHICKEN KIENYEJI ───────────────────────────────────────────────────────
  [98,  '1/2 DRY FRY CHICKEN KIENYEJI',  900,     'CHICKEN KIENYEJI'],
  [99,  '1/2 WET FRY CHICKEN KIENYEJI',  950,     'CHICKEN KIENYEJI'],
  [274, '1/4 BOILED CHICKEN KIENYEJI',   500,     'CHICKEN KIENYEJI'],
  [95,  '1/4 KIENYEJI CHICKEN CHOMA',   500,     'CHICKEN KIENYEJI'],
  [97,  '1/4 KIENYEJI CHICKEN PAN FRY', 500,     'CHICKEN KIENYEJI'],
  [96,  '1/4 KIENYEJI CHICKEN WET FRY', 500,     'CHICKEN KIENYEJI'],
  [100, 'FULL CHICKEN DRY FRY KIENYEJI',1700,    'CHICKEN KIENYEJI'],
  [102, 'FULL CHICKEN PAN FRY KIENYEJI',1800,    'CHICKEN KIENYEJI'],
  [101, 'FULL CHICKEN WET FRY KIENYEJI',1800,    'CHICKEN KIENYEJI'],

  // ── VEGETABLES ─────────────────────────────────────────────────────────────
  [64,  'CABBAGE PLAIN',                 50,      'VEGETABLES'],
  [65,  'CABBAGE MIX',                   150,     'VEGETABLES'],
  [66,  'CABBAGE SPECIAL',               150,     'VEGETABLES'],
  [60,  'MANAGU MIX',                    200,     'VEGETABLES'],
  [61,  'MANAGU MIX SPECIAL',            250,     'VEGETABLES'],
  [58,  'MANAGU PLAIN',                  100,     'VEGETABLES'],
  [59,  'MANAGU SPECIAL PLAIN',          200,     'VEGETABLES'],
  [72,  'MASHED POTATOES',               150,     'VEGETABLES'],
  [67,  'MINJI PLAIN',                   150,     'VEGETABLES'],
  [68,  'MIX VEGES',                     250,     'VEGETABLES'],
  [63,  'SUKUMA MIX',                    150,     'VEGETABLES'],
  [62,  'SUKUMA WIKI PLAIN',             50,      'VEGETABLES'],

  // ── FISH DISHES ────────────────────────────────────────────────────────────
  [44,  'FISH COCONUT CREAM',            600,     'FISH DISHES'],
  [43,  'FISH CURRY',                    600,     'FISH DISHES'],
  [241, 'FISH DRY FRY',                  550,     'FISH DISHES'],
  [45,  'FISH STEW',                     600,     'FISH DISHES'],
  [46,  'FISH WET FRY',                  600,     'FISH DISHES'],
  [425, 'PAN FRY FISH',                  600,     'FISH DISHES'],

  // ── SPECIALS ───────────────────────────────────────────────────────────────
  [313, 'CABBAGE MIX SPECIAL',           250,     'SPECIALS'],
  [309, 'CHAPATI SPECIAL 1PC',           150,     'SPECIALS'],
  [419, 'GITHERI SPECIAL',               150,     'SPECIALS'],
  [55,  'MARU BHAJIA',                   250,     'SPECIALS'],
  [427, 'MAYAI SPECIAL',                 200,     'SPECIALS'],
  [57,  'NAAN BREAD',                    80,      'SPECIALS'],
  [78,  'PILAU SPECIAL',                 250,     'SPECIALS'],
  [77,  'RICE SPECIAL',                  250,     'SPECIALS'],
  [39,  'SAMOSA SPECIAL',                150,     'SPECIALS'],
  [41,  'SAUSAGE SPECIAL',               150,     'SPECIALS'],
  [289, 'SUKUMA MIX SPECIAL',            250,     'SPECIALS'],
  [80,  'SPAGHETTI',                     150,     'SPECIALS'],
  [56,  'VEGETABLE CURRY',               300,     'SPECIALS'],

  // ── SOFT DRINKS ────────────────────────────────────────────────────────────
  [155, 'ALVARO',                        200,     'SOFT DRINKS'],
  [121, 'DASANI 1/2 LTR',                50,      'SOFT DRINKS'],
  [122, 'DASANI 1 LTR',                  100,     'SOFT DRINKS'],
  [159, 'DELMONTE',                      350,     'SOFT DRINKS'],
  [124, 'KERINGET WATER 1 LTR',          120,     'SOFT DRINKS'],
  [123, 'KERINGET WATER 1/2 LTR',        70,      'SOFT DRINKS'],
  [128, 'LIME LEMONADE',                 100,     'SOFT DRINKS'],
  [125, 'MINUTE MAID',                   120,     'SOFT DRINKS'],
  [120, 'NOVIDA',                        100,     'SOFT DRINKS'],
  [116, 'SODA 300ML',                    70,      'SOFT DRINKS'],
  [117, 'SODA 500ML',                    100,     'SOFT DRINKS'],
  [127, 'TONIC SODA',                    120,     'SOFT DRINKS'],

  // ── ENERGY DRINKS ──────────────────────────────────────────────────────────
  [126, 'MONSTER',                       350,     'ENERGY DRINKS'],
  [118, 'PREDATOR',                      100,     'ENERGY DRINKS'],
  [158, 'REDBULL',                       300,     'ENERGY DRINKS'],

  // ── BOTTLED BEER ───────────────────────────────────────────────────────────
  [137, 'BALOZI',                        250,     'BOTTLED BEER'],
  [135, 'BLACK ICE',                     250,     'BOTTLED BEER'],
  [154, 'DESPARADO',                     350,     'BOTTLED BEER'],
  [136, 'GUINNESS',                      280,     'BOTTLED BEER'],
  [151, 'HEINEKEN',                      350,     'BOTTLED BEER'],
  [153, 'HUNTERS GOLD',                  250,     'BOTTLED BEER'],
  [157, 'KINGFISHER',                    300,     'BOTTLED BEER'],
  [140, 'MANYATTA',                      280,     'BOTTLED BEER'],
  [133, 'PILSNER LAGER',                 250,     'BOTTLED BEER'],
  [139, 'PUNCH',                         250,     'BOTTLED BEER'],
  [156, 'SAVANA CIDER',                  350,     'BOTTLED BEER'],
  [130, 'SNAPP',                         250,     'BOTTLED BEER'],
  [129, 'TUSKER CIDER',                  280,     'BOTTLED BEER'],
  [131, 'TUSKER LAGER',                  250,     'BOTTLED BEER'],
  [243, 'TUSKER LITE',                   250,     'BOTTLED BEER'],
  [132, 'TUSKER MALT',                   250,     'BOTTLED BEER'],
  [138, 'WHITE CAP CRISPS',              250,     'BOTTLED BEER'],
  [134, 'WHITE CAP LAGER',               250,     'BOTTLED BEER'],
  [265, 'WINDHOEK',                      250,     'BOTTLED BEER'],

  // ── CANNED BEERS ───────────────────────────────────────────────────────────
  [149, 'BALOZI CAN',                    300,     'CANNED BEERS'],
  [299, 'BLACK ICE CAN',                 250,     'CANNED BEERS'],
  [152, 'FAXE',                          400,     'CANNED BEERS'],
  [298, 'GORDONS CAN',                   300,     'CANNED BEERS'],
  [141, 'GUARANA',                       250,     'CANNED BEERS'],
  [142, 'GUINNESS CAN',                  300,     'CANNED BEERS'],
  [297, 'MANYATTA CAN',                  300,     'CANNED BEERS'],
  [148, 'PILSNER CAN',                   300,     'CANNED BEERS'],
  [150, 'SNAPP CAN',                     300,     'CANNED BEERS'],
  [143, 'TUSKER CIDER CAN',              300,     'CANNED BEERS'],
  [144, 'TUSKER LAGER CAN',              300,     'CANNED BEERS'],
  [147, 'TUSKER LITE CAN',               300,     'CANNED BEERS'],
  [146, 'TUSKER MALT CAN',               300,     'CANNED BEERS'],
  [145, 'WHITE CAP CAN',                 300,     'CANNED BEERS'],

  // ── GIN ────────────────────────────────────────────────────────────────────
  [161, 'GILBEYS 1/2',                   850,     'GIN'],
  [160, 'GILBEYS 1/4',                   600,     'GIN'],
  [162, 'GILBEYS 750ML',                 1800,    'GIN'],
  [165, 'GORDONS DRY GIN 1 LTR',         3200,    'GIN'],
  [163, 'GORDONS DRY GIN 1/2',           1200,    'GIN'],
  [164, 'GORDONS DRY GIN 750ML',          2500,    'GIN'],

  // ── WINES ──────────────────────────────────────────────────────────────────
  [219, '4TH STREET RED',                1200,    'WINES'],
  [220, '4TH STREET WHITE',              1200,    'WINES'],
  [231, 'ASCONI',                        2200,    'WINES'],
  [225, 'CAPRICE RED',                   1300,    'WINES'],
  [226, 'CAPRICE WHITE',                 1300,    'WINES'],
  [227, 'CASABUENA RED',                 1200,    'WINES'],
  [228, 'CASABUENA WHITE',               1200,    'WINES'],
  [222, 'CELLAR CASK RED',               1200,    'WINES'],
  [221, 'CELLAR CASK WHITE',             1200,    'WINES'],
  [223, 'DROSDTY HOF RED',               1200,    'WINES'],
  [224, 'DROSDTY HOF WHITE',             1200,    'WINES'],
  [229, 'FOUR COUSINS RED',              1400,    'WINES'],
  [230, 'FOUR COUSINS WHITE',            1400,    'WINES'],
  [166, 'NUDEBURG',                      2800,    'WINES'],
  [401, 'ROBERTSON',                     1700,    'WINES'],

  // ── BRANDY ─────────────────────────────────────────────────────────────────
  [172, 'RICHOT 1/2',                    800,     'BRANDY'],
  [171, 'RICHOT 1/4',                    600,     'BRANDY'],
  [173, 'RICHOT 750ML',                  1700,    'BRANDY'],
  [168, 'VICEROY 1/2',                   900,     'BRANDY'],
  [167, 'VICEROY 1/4',                   650,     'BRANDY'],
  [170, 'VICEROY 10 YRS',                4500,    'BRANDY'],
  [169, 'VICEROY 750ML',                 1800,    'BRANDY'],

  // ── VODKA ──────────────────────────────────────────────────────────────────
  [175, 'VODKA 1/2',                     800,     'VODKA'],
  [174, 'VODKA 1/4',                     600,     'VODKA'],
  [312, 'VODKA 1 LTR',                   2300,    'VODKA'],
  [176, 'VODKA 750ML',                   1600,    'VODKA'],

  // ── SPIRITS ────────────────────────────────────────────────────────────────
  [178, 'KC 1/2',                        600,     'SPIRITS'],
  [177, 'KC 1/4',                        450,     'SPIRITS'],
  [179, 'KC 750ML',                      1100,    'SPIRITS'],

  // ── WHISKY ─────────────────────────────────────────────────────────────────
  [263, 'ALL SEASONS',                   1400,    'WHISKY'],
  [217, 'BEST WHISKY 1/4',               500,     'WHISKY'],
  [218, 'BEST WHISKY 750ML',             1400,    'WHISKY'],
  [212, 'BLACK & WHITE 1/2',             800,     'WHISKY'],
  [213, 'BLACK & WHITE 750ML',           1400,    'WHISKY'],
  [195, 'BOND 7 1/2',                    800,     'WHISKY'],
  [194, 'BOND 7 1/4',                    600,     'WHISKY'],
  [196, 'BOND 7 750ML',                  1700,    'WHISKY'],
  [300, 'BULLEIT BOURBON',               5800,    'WHISKY'],
  [307, 'DOUBLE BLACK 1 LTR',            7000,    'WHISKY'],
  [197, 'FAMOUS GROUSE',                 2500,    'WHISKY'],
  [198, 'GLENFIDICH 12 YRS',             8500,    'WHISKY'],
  [199, 'GLENFIDICH 15 YRS',             12000,   'WHISKY'],
  [200, 'GLENFIDICH 18 YRS',             17500,   'WHISKY'],
  [209, 'GRANTS 1/2',                    1600,    'WHISKY'],
  [211, 'GRANTS 1 LTR',                  3200,    'WHISKY'],
  [210, 'GRANTS 750ML',                  2500,    'WHISKY'],
  [204, 'HENNESY 1 LTR',                 13500,   'WHISKY'],
  [203, 'HENNESY 700ML',                 7500,    'WHISKY'],
  [215, 'HUNTERS 1/2',                   800,     'WHISKY'],
  [214, 'HUNTERS 1/4',                   600,     'WHISKY'],
  [216, 'HUNTERS 750ML',                 1300,    'WHISKY'],
  [191, 'J. WALKER BLACK 1/2',           2500,    'WHISKY'],
  [190, 'J. WALKER BLACK 1/4',           1300,    'WHISKY'],
  [193, 'J. WALKER BLACK 1 LTR',         5500,    'WHISKY'],
  [192, 'J. WALKER BLACK 750ML',         4500,    'WHISKY'],
  [417, 'J. WALKER BLONDE',              4000,    'WHISKY'],
  [189, 'J. WALKER RED 1 LTR',           3000,    'WHISKY'],
  [187, 'J. WALKER RED 1/2',             1700,    'WHISKY'],
  [186, 'J. WALKER RED 1/4',             1000,    'WHISKY'],
  [188, 'J. WALKER RED 750ML',           2500,    'WHISKY'],
  [205, 'JACK DANIELS 1/2',              2500,    'WHISKY'],
  [207, 'JACK DANIELS 1 LTR',            6000,    'WHISKY'],
  [206, 'JACK DANIELS 750ML',            4500,    'WHISKY'],
  [183, 'JAMESON 1 LTR',                 4500,    'WHISKY'],
  [181, 'JAMESON 1/2',                   1600,    'WHISKY'],
  [182, 'JAMESON 750ML',                 3500,    'WHISKY'],
  [201, 'MARTEL 750ML',                  8500,    'WHISKY'],
  [202, 'MARTEL VSOP',                   12500,   'WHISKY'],
  [422, 'SINGLETON 12 YRS',              5800,    'WHISKY'],
  [180, 'SOUTHERN COMFORT',              3200,    'WHISKY'],
  [184, 'VAT 69 1/2',                    1000,    'WHISKY'],
  [185, 'VAT 69 750ML',                  1800,    'WHISKY'],
  [413, 'WILLIAM LAWSONS 1 LTR',         2500,    'WHISKY'],
  [208, 'WILLIAM LAWSONS 750ML',         2200,    'WHISKY'],

  // ── RUM & LIQUOR ───────────────────────────────────────────────────────────
  [264, 'AMARULA 1/2',                   1400,    'RUM & LIQUOR'],
  [301, 'AMARULA 750ML',                 2400,    'RUM & LIQUOR'],
  [302, 'BAILEYS 1/2',                   1500,    'RUM & LIQUOR'],
  [303, 'BAILEYS 750ML',                 3000,    'RUM & LIQUOR'],
  [235, 'CAMINO',                        5000,    'RUM & LIQUOR'],
  [232, 'CAPTAIN MORGAN 1/4',            500,     'RUM & LIQUOR'],
  [233, 'CAPTAIN MORGAN 750ML',          1300,    'RUM & LIQUOR'],
  [281, 'V&A',                           1200,    'RUM & LIQUOR'],

  // ── TOTS ───────────────────────────────────────────────────────────────────
  [237, 'CAMINO TOT',                    200,     'TOTS'],
  [236, 'JAGERMEISTER TOT',              200,     'TOTS'],

  // ── OTHERS ─────────────────────────────────────────────────────────────────
  [240, 'GLASS BREAKAGE',               100,     'OTHERS'],
  [420, 'HALL HIRE',                     1000,    'OTHERS'],
  [426, 'LEMON SLICES',                  20,      'OTHERS'],
  [421, 'LUNCH BUFFET',                  800,     'OTHERS'],
  [268, 'MARA MOJA',                     20,      'OTHERS'],
  [267, 'NESCAFE',                       20,      'OTHERS'],
  [238, 'POOL TOKEN',                    30,      'OTHERS'],
  [310, 'SERVICE CHARGE',               200,     'OTHERS'],
  [311, 'TAKE AWAY CUP',                20,      'OTHERS'],
  [258, 'TIN',                           20,      'OTHERS'],
  [418, 'TRANSPORT',                     60,      'OTHERS'],
  [239, 'TRUST STUDDED',                100,     'OTHERS'],
  [424, 'USED COOKING OIL',             90,      'OTHERS'],
  [428, 'WHISKY GLASS',                  200,     'OTHERS'],
  [429, 'WINE GLASS',                    150,     'OTHERS'],

  // ── ACCOMPANIMENT ──────────────────────────────────────────────────────────
  [69,  'CHIPS FRY',                     150,     'ACCOMPANIMENT'],
  [70,  'CHIPS MASALA',                  200,     'ACCOMPANIMENT'],
  [266, 'CHIPS TAKEAWAY',               170,     'ACCOMPANIMENT'],
  [308, 'GITHERI',                       100,     'ACCOMPANIMENT'],
  [76,  'PILAU PLAIN',                   200,     'ACCOMPANIMENT'],
  [75,  'RICE PLAIN',                    150,     'ACCOMPANIMENT'],
  [71,  'ROAST POTATOES',               250,     'ACCOMPANIMENT'],
  [272, 'SAUTE POTATOES',               250,     'ACCOMPANIMENT'],
  [74,  'UGALI (BROWN)',                 100,     'ACCOMPANIMENT'],
  [73,  'UGALI (WHITE)',                 50,      'ACCOMPANIMENT'],
  [79,  'VEGETABLE RICE',               200,     'ACCOMPANIMENT'],

  // ── SALADS ─────────────────────────────────────────────────────────────────
  [47,  'KACHUMBARI',                    50,      'SALADS'],
  [48,  'SALADS',                        50,      'SALADS'],

  // ── SOUPS ──────────────────────────────────────────────────────────────────
  [51,  'BEEF STOCK SOUP',               100,     'SOUPS'],
  [53,  'BONE MARROW SOUP PLAIN',        200,     'SOUPS'],
  [52,  'CLEAR SOUP',                    100,     'SOUPS'],
  [257, 'SOUP CHAPATI 2PCS',             150,     'SOUPS'],
  [260, 'SOUP SPECIAL',                  150,     'SOUPS'],
  [50,  'TOMATO SOUP',                   50,      'SOUPS'],

  // ── DESSERTS ───────────────────────────────────────────────────────────────
  [262, 'FRUIT PLATTER',                 200,     'DESSERTS'],
  [261, 'FRUIT SALAD',                   150,     'DESSERTS'],
  [49,  'HONEY',                         50,      'DESSERTS'],

  // ── EGGS ───────────────────────────────────────────────────────────────────
  [271, 'BOILED EGGS (BROILER)',         100,     'EGGS'],
  [269, 'BOILED EGGS (KIENYEJI)',        120,     'EGGS'],
  [35,  'EGG SANDWICH',                  150,     'EGGS'],
  [32,  'FRIED EGGS (2PCS)',             100,     'EGGS'],
  [273, 'SCRAMBLED EGGS KIENYEJI',       150,     'EGGS'],
  [36,  'SCRAMBLED EGGS (BROILER)',      100,     'EGGS'],
];

// ─── CATEGORY → MENU TYPE MAPPING ─────────────────────────────────────────────
// bar = goes to Main Bar POS | menu = goes to Restaurant POS
const CATEGORY_MENU_TYPE = {
  'HOT BEVERAGES':      'menu',
  'COLD BEVERAGES':     'menu',
  'MUTTON':             'menu',
  'BEEF':               'menu',
  'CHICKEN BROILERS':   'menu',
  'SNACKS':             'menu',
  'CHICKEN KIENYEJI':   'menu',
  'VEGETABLES':         'menu',
  'FISH DISHES':        'menu',
  'SPECIALS':           'menu',
  'SOFT DRINKS':        'bar',
  'ENERGY DRINKS':      'bar',
  'BOTTLED BEER':       'bar',
  'CANNED BEERS':       'bar',
  'GIN':                'bar',
  'WINES':              'bar',
  'BRANDY':             'bar',
  'VODKA':              'bar',
  'SPIRITS':            'bar',
  'WHISKY':             'bar',
  'RUM & LIQUOR':       'bar',
  'TOTS':               'bar',
  'OTHERS':             'menu',
  'ACCOMPANIMENT':      'menu',
  'SALADS':             'menu',
  'SOUPS':              'menu',
  'DESSERTS':           'menu',
  'EGGS':               'menu',
};

// ─── CATEGORY → UNIT MAPPING ───────────────────────────────────────────────────
const CATEGORY_UNIT = {
  'HOT BEVERAGES':      'portion',
  'COLD BEVERAGES':     'portion',
  'MUTTON':             'portion',
  'BEEF':               'portion',
  'CHICKEN BROILERS':   'portion',
  'SNACKS':             'each',
  'CHICKEN KIENYEJI':   'portion',
  'VEGETABLES':         'portion',
  'FISH DISHES':        'portion',
  'SPECIALS':           'portion',
  'SOFT DRINKS':        'each',
  'ENERGY DRINKS':      'each',
  'BOTTLED BEER':       'each',
  'CANNED BEERS':       'each',
  'GIN':                'each',
  'WINES':              'each',
  'BRANDY':             'each',
  'VODKA':              'each',
  'SPIRITS':            'each',
  'WHISKY':             'each',
  'RUM & LIQUOR':       'each',
  'TOTS':               'each',
  'OTHERS':             'each',
  'ACCOMPANIMENT':      'portion',
  'SALADS':             'portion',
  'SOUPS':              'portion',
  'DESSERTS':           'portion',
  'EGGS':               'each',
};

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── BUILD RECORDS ─────────────────────────────────────────────────────────────
function buildRecords() {
  return MENU_ITEMS.map(([code, name, price, category]) => {
    const isBar    = BAR_CATEGORIES.has(category);
    const outletId = isBar ? MAIN_BAR_OUTLET_ID : RESTAURANT_OUTLET_ID;
    // Use outlet-specific SKU prefix to avoid collision if same code appears in both outlets
    const skuPrefix = isBar ? 'MOG-BAR' : 'MOG-RES';
    const sku = `${skuPrefix}-${String(code).padStart(4, '0')}`;
    return {
      branch_id:      BRANCH_ID,
      sku,
      name:           name.trim(),
      category:       category,
      selling_price:  price,
      price:          price,
      cost_price:     0,
      unit:           CATEGORY_UNIT[category] || 'portion',
      menu_type:      CATEGORY_MENU_TYPE[category] || 'menu',
      is_available:   true,
      is_active:      true,
      stock_quantity: 0,
      reorder_level:  0,
      is_low_stock:   false,
      metadata: {
        source_code:  code,
        outlet_id:    outletId,
        outlet_type:  isBar ? 'main_bar' : 'restaurant',
        seeded_from:  'rptitemspricelist_pdf',
        branch_name:  BRANCH_NAME,
      },
    };
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' MOGOGOSHIEK POS Menu Seed (Restaurant + Main Bar)');
  console.log(` Branch:      ${BRANCH_NAME} (ID: ${BRANCH_ID})`);
  console.log(` Restaurant:  ${RESTAURANT_OUTLET_ID}`);
  console.log(` Main Bar:    ${MAIN_BAR_OUTLET_ID}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // 1. Verify branch
  console.log('\n[1/5] Verifying branch...');
  const branch = await supabaseRequest('GET', `branches?id=eq.${BRANCH_ID}&select=id,name,code`);
  if (!branch || branch.length === 0) throw new Error(`Branch ID ${BRANCH_ID} not found!`);
  console.log(`      ✓ ${branch[0].name} (${branch[0].code})`);

  // 2. Verify restaurant outlet
  console.log('[2/5] Verifying restaurant outlet...');
  const resOutlet = await supabaseRequest('GET', `pos_outlets?id=eq.${RESTAURANT_OUTLET_ID}&select=id,name,outlet_type`);
  if (!resOutlet || resOutlet.length === 0) throw new Error(`Restaurant outlet ${RESTAURANT_OUTLET_ID} not found!`);
  console.log(`      ✓ ${resOutlet[0].name} (${resOutlet[0].outlet_type})`);

  // 3. Verify main bar outlet
  console.log('[3/5] Verifying main bar outlet...');
  const barOutlet = await supabaseRequest('GET', `pos_outlets?id=eq.${MAIN_BAR_OUTLET_ID}&select=id,name,outlet_type`);
  if (!barOutlet || barOutlet.length === 0) throw new Error(`Main Bar outlet ${MAIN_BAR_OUTLET_ID} not found!`);
  console.log(`      ✓ ${barOutlet[0].name} (${barOutlet[0].outlet_type})`);

  // 4. Delete previously seeded items for this branch (clean re-seed)
  console.log('[4/5] Clearing previously seeded items for MOGOGOSHIEK...');
  const existing = await supabaseRequest('GET', `restaurant_menu_items?branch_id=eq.${BRANCH_ID}&select=id,sku`);
  if (existing && existing.length > 0) {
    await supabaseRequest('DELETE', `restaurant_menu_items?branch_id=eq.${BRANCH_ID}`);
    console.log(`      ✓ Deleted ${existing.length} old items.`);
  } else {
    console.log('      ✓ No existing items found — clean seed.');
  }

  // 5. Insert in batches
  console.log('[5/5] Inserting menu items...');
  const records = buildRecords();
  const barRecords = records.filter(r => BAR_CATEGORIES.has(r.category));
  const resRecords = records.filter(r => !BAR_CATEGORIES.has(r.category));
  console.log(`      Restaurant items: ${resRecords.length}`);
  console.log(`      Main Bar items:   ${barRecords.length}`);
  console.log(`      Total:            ${records.length}`);
  console.log('');

  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;
  const categorySummary = {};

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      const result = await supabaseRequest(
        'POST',
        'restaurant_menu_items?on_conflict=sku,branch_id',
        batch,
      );
      const count = Array.isArray(result) ? result.length : batch.length;
      inserted += count;
      batch.forEach(r => {
        const isBar = BAR_CATEGORIES.has(r.category);
        const key = `${isBar ? '[BAR] ' : '[RES] '}${r.category}`;
        categorySummary[key] = (categorySummary[key] || 0) + 1;
      });
      process.stdout.write(`      Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)}: ${count} items\r`);
    } catch (err) {
      console.log(`\n      Batch ${Math.floor(i / BATCH_SIZE) + 1} conflict — retrying individually...`);
      for (const record of batch) {
        try {
          await supabaseRequest('POST', 'restaurant_menu_items?on_conflict=sku,branch_id', [record]);
          inserted++;
          const isBar = BAR_CATEGORIES.has(record.category);
          const key = `${isBar ? '[BAR] ' : '[RES] '}${record.category}`;
          categorySummary[key] = (categorySummary[key] || 0) + 1;
        } catch (e2) {
          console.log(`        ✗ Skipped "${record.name}": ${e2.message}`);
          skipped++;
        }
      }
    }
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(' SEED COMPLETE');
  console.log(`  Total:            ${records.length}`);
  console.log(`  Inserted/updated: ${inserted}`);
  console.log(`  Skipped (errors): ${skipped}`);
  console.log(`\n  Restaurant POS → ${resRecords.length} food & beverage items`);
  console.log(`  Main Bar POS   → ${barRecords.length} bar & drinks items`);
  console.log('\n  Breakdown by outlet + category:');
  const barEntries = Object.entries(categorySummary).filter(([k]) => k.startsWith('[BAR]'));
  const resEntries = Object.entries(categorySummary).filter(([k]) => k.startsWith('[RES]'));
  console.log('  -- Restaurant POS --');
  resEntries.sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`    ${cat.replace('[RES] ', '').padEnd(25)} ${count}`);
  });
  console.log('  -- Main Bar POS --');
  barEntries.sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`    ${cat.replace('[BAR] ', '').padEnd(25)} ${count}`);
  });
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n✗ SEED FAILED:', err.message);
  process.exit(1);
});
