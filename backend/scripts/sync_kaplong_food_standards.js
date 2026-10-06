const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { supabase } = require('../dist/config/supabase');

const KAPLONG_BRANCH_ID = 3;
const KAPLONG_RESTAURANT_OUTLET_ID = '9ebb1fc0-1716-4db7-80e8-6c727a05213c';

// Definition of all 21 food families to configure for Kaplong
const FOOD_FAMILIES = [
  // 1. BEEF STEAK
  {
    raw_sku: 'FGH-DRY-GOODS-018',
    raw_name: 'BEEF STEAK',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: '1KG BEEF STEW/WET FRY', qty: 1.0 },
      { name: '1/2 BEEF WET FRY', qty: 2.0 },
      { name: '1/4 BEEF WET FRY', qty: 4.0 },
      { name: '1/4 BEEF STEW', qty: 4.0 },
      { name: 'BEEF CURRY', qty: 4.0 },
      { name: 'SPECIAL CABBAGE/SUKUMA', qty: 10.0 },
      { name: 'MIX CABBAGE/SUKUMA', qty: 10.0 },
      { name: 'MIX SKUMA/CABBAGE', qty: 10.0 },
      { name: 'SUKUMA MIXED SPECIAL', qty: 10.0 },
      { name: 'MANAGU MIX', qty: 10.0 },
      { name: 'MANAGU MIX SPECIAL', qty: 10.0 },
      { name: 'MANAGU MIX SPECIAL/CHAPO', qty: 10.0 },
      { name: 'GITHERI SPECIAL', qty: 12.0 },
      { name: 'PILAU SPECIAL', qty: 12.0 },
      { name: 'RICE SPECIAL', qty: 12.0 },
    ]
  },

  // 2. MBUZI
  {
    raw_sku: 'FGH-DRY-GOODS-117',
    raw_name: 'MBUZI',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: '1 KG MBUZI CHOMA', qty: 1.0 },
      { name: '3/4 MBUZI CHOMA', qty: 1.333 },
      { name: '1/2 MBUZI CHOMA', qty: 2.0 },
      { name: '1/4 MBUZI CHOMA', qty: 4.0 },
      { name: '1 KG MBUZI WET FRY', qty: 1.0 },
      { name: '3/4 MBUZI WET FRY', qty: 1.333 },
      { name: '1/2 MBUZI WET FRY', qty: 2.0 },
      { name: '1/4 MBUZI WET FRY', qty: 4.0 },
      { name: '1 KG MBUZI PAN FRY', qty: 1.0 },
      { name: '3/4 MBUZI PAN FRY', qty: 1.333 },
      { name: '1/2 PAN FRY MBUZI CHOMA', qty: 2.0 },
      { name: '1/4 MBUZI PAN FRY', qty: 4.0 },
      { name: '1/4 PAN FRY MBUZI CHOMA', qty: 4.0 },
      { name: '1 KG MBUZI BOIL TUMBUKIZA', qty: 1.0 },
      { name: '1KG TUMBUKIZA', qty: 1.0 },
      { name: '3/4 MBUZI BOIL TUMBUKIZA', qty: 1.333 },
      { name: '1/2 MBUZI BOIL TUMBUKIZA', qty: 2.0 },
      { name: '1/4 MBUZI BOIL TUMBUKIZA', qty: 4.0 },
    ]
  },

  // 3. BROILERS
  {
    raw_sku: 'FGH-DRY-GOODS-026',
    raw_name: 'BROILERS',
    raw_qty: 1.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'FULL CHICKEN FRY/WET BROILER', qty: 1.0 },
      { name: '1/2 FRIED CHICKEN BROILER', qty: 2.0 },
      { name: '1/2 PAN FRIED CHICKEN BROILER', qty: 2.0 },
      { name: '1/2 PLAIN CHICKEN BROILER', qty: 2.0 },
      { name: '1/2 WET FRY CHICKEN BROILER', qty: 2.0 },
      { name: '1/2 CHICKEN LOLLIPOP', qty: 2.0 },
      { name: '1/2 CHICKEN BYRIANI', qty: 2.0 },
      { name: '1/4 CHICKEN FRIED BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN WET FRY BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN CHOMA BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN PLAIN BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN SPECIAL BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN LOLLIPOP', qty: 4.0 },
      { name: '1/4 CHICKEN MARYLAND', qty: 4.0 },
      { name: '1/4 CHICKEN BONELESS', qty: 4.0 },
      { name: '1/4 CHICKEN CURRY/MASALA BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN BYRIANI BROILER', qty: 4.0 },
      { name: 'CHICKEN BERBEQUE', qty: 4.0 },
    ]
  },

  // 4. KUKU KIENYEJI
  {
    raw_sku: 'FGH-DRY-GOODS-101',
    raw_name: 'KUKU KIENYEJI',
    raw_qty: 1.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'FULL CHICKEN KIENYEJI', qty: 1.0 },
      { name: '3/4 WET FRY CHICKEN KIENYEJI', qty: 1.333 },
      { name: '1/2 WET FRY CHICKEN KIENYEJI', qty: 2.0 },
      { name: '1/2 FRIED CHICKEN KIENYEJI', qty: 2.0 },
      { name: '1/2 PAN FRIED CHICKEN KIENYEJI', qty: 2.0 },
      { name: '1/2 PAN FRY CHICKEN KIENYEJI', qty: 2.0 },
      { name: '1/2 MASALA CHICKEN KIENYEJI', qty: 2.0 },
      { name: '1/4 WET FRY CHICKEN KIENYEJI', qty: 4.0 },
      { name: '1/4 FRY CHICKEN KIENYEJI', qty: 4.0 },
      { name: '1/4 PAN FRY CHICKEN KIENYEJI', qty: 4.0 },
      { name: '1/4 MASALA CHICKEN KIENYEJI', qty: 4.0 },
      { name: '1/4 CHICKEN SPECIAL KIENYEJI', qty: 4.0 },
    ]
  },

  // 5. FISH
  {
    raw_sku: 'FGH-DRY-GOODS-070',
    raw_name: 'FISH',
    raw_qty: 1.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'FISH DRY', qty: 1.0 },
      { name: 'FISH WET FRY', qty: 1.0 },
      { name: 'FISH STEW', qty: 1.0 },
      { name: 'BOILED FISH', qty: 1.0 },
      { name: 'FISH MASALA', qty: 1.0 },
      { name: 'COCONUT FISH', qty: 1.0 },
      { name: 'FISH CURRY', qty: 1.0 },
      { name: 'FISH FILLET', qty: 1.0 },
    ]
  },

  // 6. BROILERS EGGS
  {
    raw_sku: 'FGH-DRY-GOODS-027',
    raw_name: 'BROILERS EGGS',
    raw_qty: 2.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'BOILED EGG 1', qty: 2.0 },
      { name: 'BOILED EGG', qty: 1.0 },
      { name: 'FRIED EGG (BROILER)', qty: 2.0 },
      { name: 'SPANISH OMELLETE (BROILER)', qty: 2.0 },
      { name: 'SPANISH OMELLETE', qty: 2.0 },
      { name: 'SCRAMBLED EGGS(BROILER)', qty: 2.0 },
      { name: 'EGGS FRY MACHO', qty: 2.0 },
      { name: 'EGG SPECIAL BROILER', qty: 2.0 },
      { name: 'EGG SANDWICH', qty: 2.0 },
    ]
  },

  // 7. KIENYEJI EGGS
  {
    raw_sku: 'FGH-DRY-GOODS-098',
    raw_name: 'KIENYEJI EGGS',
    raw_qty: 2.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'FRIED EGG (KIENYEJI)', qty: 2.0 },
      { name: 'SCRAMBLED EGGS(KIENYEJI)', qty: 2.0 },
      { name: 'SPANISH OMELLETE (KIENYEJI)', qty: 2.0 },
      { name: 'EGG SPECIAL KIENYEJI', qty: 2.0 },
    ]
  },

  // 8. POTATOES
  {
    raw_sku: 'FGH-DRY-GOODS-148',
    raw_name: 'POTATOES',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'CHIPS', qty: 2.0 },
      { name: 'CHIPS MASALA', qty: 2.0 },
      { name: 'GARLIC CHIPS', qty: 2.0 },
      { name: 'BOILED POTATOES', qty: 2.0 },
      { name: 'ROAST POTATOES', qty: 1.5 },
      { name: 'MASHED POTATOES', qty: 1.5 },
      { name: 'POTATOE WEDGES', qty: 2.0 },
      { name: 'PCUISSINS CHIPS', qty: 2.0 },
      { name: 'SOUTE POTATOES (B)', qty: 2.0 },
      { name: 'BHAJIA', qty: 2.0 },
      { name: 'SAMOSA SPECIAL', qty: 4.0 },
      { name: 'SAUSAGE SPECIAL', qty: 4.0 },
      { name: 'KEBAB SPECIAL', qty: 4.0 },
      { name: '1/4 CHICKEN SPECIAL BROILER', qty: 4.0 },
      { name: '1/4 CHICKEN SPECIAL KIENYEJI', qty: 4.0 },
      { name: 'GITHERI SPECIAL', qty: 6.0 },
      { name: 'PILAU SPECIAL', qty: 6.0 },
      { name: 'RICE SPECIAL', qty: 6.0 },
    ]
  },

  // 9. BASMATTI RICE
  {
    raw_sku: 'FGH-DRY-GOODS-013',
    raw_name: 'BASMATI RICE',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'PILAU', qty: 7.0 },
      { name: 'PILAU PLAIN', qty: 7.0 },
      { name: 'PILAU SPECIAL', qty: 7.0 },
      { name: 'RICE', qty: 7.0 },
      { name: 'RICE SPECIAL', qty: 7.0 },
      { name: 'VEGETABLE RICE', qty: 7.0 },
      { name: 'VEGETABLE RICE SPECIAL', qty: 7.0 },
    ]
  },

  // 10. AJAB UGALI
  {
    raw_sku: 'FGH-DRY-GOODS-006',
    raw_name: 'AJAB UGALI',
    raw_qty: 2.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'UGALI', qty: 8.0 },
    ]
  },

  // 11. JOGOO WIMBI
  {
    raw_sku: 'FGH-DRY-GOODS-091',
    raw_name: 'JOGOO WIMBI',
    raw_qty: 2.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'UGALI BROWN', qty: 10.0 },
    ]
  },

  // 12. ATTARMARK
  {
    raw_sku: 'FGH-DRY-GOODS-007',
    raw_name: 'ATTARMARK',
    raw_qty: 1.0,
    raw_unit: 'pkt',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'CHAPATI BROWN', qty: 30.0 },
      { name: 'DRIED CHAPATI', qty: 30.0 },
    ]
  },

  // 13. SUKUMA WIKI
  {
    raw_sku: 'FGH-DRY-GOODS-176',
    raw_name: 'SUKUMA WIKI',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'SUKUMA', qty: 4.0 },
      { name: 'SPECIAL CABBAGE/SUKUMA', qty: 4.0 },
      { name: 'MIX CABBAGE/SUKUMA', qty: 4.0 },
      { name: 'MIX SKUMA/CABBAGE', qty: 4.0 },
      { name: 'SUKUMA MIXED SPECIAL', qty: 4.0 },
    ]
  },

  // 14. PEAS / MINJI
  {
    raw_sku: 'FGH-DRY-GOODS-141',
    raw_name: 'PEAS',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'MINJI', qty: 4.0 },
      { name: 'MINJI SPECIAL', qty: 4.0 },
      { name: 'PILAU SPECIAL', qty: 8.0 },
      { name: 'RICE SPECIAL', qty: 8.0 },
      { name: 'SPECIAL CABBAGE/SUKUMA', qty: 8.0 },
      { name: 'SUKUMA MIXED SPECIAL', qty: 8.0 },
      { name: 'MANAGU SPECIAL', qty: 8.0 },
      { name: 'MANAGU MIX SPECIAL', qty: 8.0 },
    ]
  },

  // 15. YELLOW BEANS
  {
    raw_sku: 'FGH-DRY-GOODS-215',
    raw_name: 'YELLOW BEANS',
    raw_qty: 1.0,
    raw_unit: 'kg',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'BEANS', qty: 8.0 },
      { name: 'GITHERI', qty: 12.0 },
      { name: 'GITHERI SPECIAL', qty: 12.0 },
    ]
  },

  // 16. SAUSAGES
  {
    raw_sku: 'FGH-DRY-GOODS-158',
    raw_name: 'SAUSAGES',
    raw_qty: 1.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'SAUSAGE', qty: 1.0 },
      { name: 'SAUSAGE SPECIAL', qty: 1.0 },
      { name: 'SAUSAGE BITES', qty: 1.0 },
      { name: 'SMOKIE (B)', qty: 1.0 },
    ]
  },

  // 17. FRESH MILK
  {
    raw_sku: 'FGH-DRY-GOODS-074',
    raw_name: 'FRESH MILK',
    raw_qty: 1.0,
    raw_unit: 'ltr',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'FRESH MILK 500ML', qty: 2.0 },
      { name: 'GLASS MILK LARGE', qty: 2.0 },
      { name: 'GLASS MILK SMALL', qty: 4.0 },
      { name: 'TEA POT', qty: 2.0 },
      { name: 'TEA MASALA POT', qty: 2.0 },
      { name: 'SPECIAL TEA POT', qty: 2.0 },
      { name: 'SPECIAL TEA MASALA POT', qty: 2.0 },
      { name: 'SPECIAL TEA POT 1L', qty: 1.0 },
      { name: 'TEA MUG', qty: 5.0 },
      { name: 'TEA MASALA MUG', qty: 5.0 },
      { name: 'TEA MUG WITH GINGER', qty: 5.0 },
      { name: 'GINGER TEA MUG', qty: 5.0 },
      { name: 'SPECIAL TEA MUG', qty: 3.0 },
      { name: 'MILK SHAKE', qty: 8.0 },
      { name: 'TEA FLASK LARGE', qty: 1.0 },
      { name: 'TEA FLASK XTRA LARGE', qty: 1.0 },
      { name: 'TEA FLASK MEDIUM', qty: 2.0 },
      { name: 'MANAGU', qty: 8.0 },
      { name: 'MANAGU MIX', qty: 8.0 },
      { name: 'MANAGU SPECIAL', qty: 8.0 },
      { name: 'MANAGU MIX SPECIAL', qty: 8.0 },
      { name: 'SPECIAL CABBAGE/SUKUMA', qty: 8.0 },
      { name: 'SUKUMA MIXED SPECIAL', qty: 8.0 },
    ]
  },

  // 18. Mursik Glass
  {
    raw_sku: 'FGH-CBV-0008',
    raw_name: 'Mursik Glass',
    raw_qty: 1.0,
    raw_unit: 'ltr',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'MURSIK GLASS', qty: 3.0 },
      { name: 'MURSIK 1L', qty: 1.0 },
    ]
  },

  // 19. BANANAS
  {
    raw_sku: 'FGH-DRY-GOODS-011',
    raw_name: 'BANANAS',
    raw_qty: 2.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'BANANA', qty: 2.0 },
    ]
  },

  // 20. MANGOES
  {
    raw_sku: 'FGH-DRY-GOODS-109',
    raw_name: 'MANGOES',
    raw_qty: 1.0,
    raw_unit: 'pcs',
    yield_type: 'COMPLEX',
    stocktake_mode: 'RAW_ONLY',
    stocktake_loc: 'BOTH',
    outputs: [
      { name: 'MANGOES', qty: 1.0 },
      { name: 'FRESH COCKTAIL/MANGO', qty: 1.0 },
    ]
  },

  // 21. PRODUCTION BATCH ITEMS (Multiple Inputs)
  // Kitchen-only, Produced-only stocktake
  {
    raw_sku: 'MULTI',
    raw_name: 'Multiple Inputs',
    raw_qty: 0,
    raw_unit: 'mixed',
    yield_type: 'PRODUCTION',
    stocktake_mode: 'PRODUCED_ONLY',
    stocktake_loc: 'KITCHEN',
    outputs: [
      {
        name: 'CHAPATI WHITE',
        qty: 35.0,
        recipe_title: 'EXE ALL PURPOSE to Chapati White',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 2.0, unit: 'pkt' },
          { sku: 'FGH-DRY-GOODS-149', name: 'PRESTIGE', qty: 0.02, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-074', name: 'FRESH MILK', qty: 0.5, unit: 'ltr' },
          { sku: 'FGH-DRY-GOODS-174', name: 'SUGAR KG', qty: 0.25, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-156', name: 'SALT PER 2KG', qty: 0.02, unit: 'kg' },
        ]
      },
      {
        name: 'SPECIAL CHAPATI',
        qty: 35.0,
        recipe_title: 'EXE ALL PURPOSE to Special Chapati',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 2.0, unit: 'pkt' },
          { sku: 'FGH-DRY-GOODS-149', name: 'PRESTIGE', qty: 0.02, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-074', name: 'FRESH MILK', qty: 0.5, unit: 'ltr' },
          { sku: 'FGH-DRY-GOODS-174', name: 'SUGAR KG', qty: 0.25, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-156', name: 'SALT PER 2KG', qty: 0.02, unit: 'kg' },
        ]
      },
      {
        name: 'NDAZI',
        qty: 90.0,
        recipe_title: 'SELFRAISING to Ndazi',
        inputs: [
          { sku: 'FGH-DRY-GOODS-160', name: 'SELFRAISING', qty: 2.0, unit: 'pkt' },
          { sku: 'FGH-DRY-GOODS-174', name: 'SUGAR KG', qty: 0.5, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-074', name: 'FRESH MILK', qty: 0.5, unit: 'ltr' },
          { sku: 'FGH-DRY-GOODS-149', name: 'PRESTIGE', qty: 0.02, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-104', name: 'LEMONS', qty: 2.0, unit: 'pcs' },
        ]
      },
      {
        name: 'SAMOSA',
        qty: 30.0,
        recipe_title: 'EXE ALL PURPOSE to Samosa',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 0.5, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-122', name: 'MINCED MEAT', qty: 1.0, unit: 'kg' },
        ]
      },
      {
        name: 'SAMOSA SPECIAL',
        qty: 30.0,
        recipe_title: 'EXE ALL PURPOSE to Samosa Special',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 0.5, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-122', name: 'MINCED MEAT', qty: 1.0, unit: 'kg' },
        ]
      },
      {
        name: 'KEBAB',
        qty: 10.0,
        recipe_title: 'EXE ALL PURPOSE + MINCED MEAT -> Kebab',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 0.01, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-122', name: 'MINCED MEAT', qty: 0.25, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-027', name: 'BROILERS EGGS', qty: 5.0, unit: 'pcs' },
        ]
      },
      {
        name: 'KEBAB SPECIAL',
        qty: 10.0,
        recipe_title: 'EXE ALL PURPOSE + MINCED MEAT -> Kebab Special',
        inputs: [
          { sku: 'FGH-DRY-GOODS-066', name: 'EXE ALL PURPOSE', qty: 0.01, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-122', name: 'MINCED MEAT', qty: 0.25, unit: 'kg' },
          { sku: 'FGH-DRY-GOODS-027', name: 'BROILERS EGGS', qty: 5.0, unit: 'pcs' },
        ]
      },
    ]
  }
];

async function applyFoodControlStandards() {
  console.log('1. Loading Kaplong Restaurant POS Items...');
  const { data: posItems, error: posErr } = await supabase
    .from('pos_outlet_items')
    .select('id, name, selling_price, category')
    .eq('outlet_id', KAPLONG_RESTAURANT_OUTLET_ID)
    .eq('is_active', true);

  if (posErr) throw posErr;
  const posByName = new Map();
  posItems.forEach(p => posByName.set(p.name.trim().toUpperCase(), p));

  console.log(`Loaded ${posByName.size} active POS items.`);

  // 1. Build recipe rows
  const allInsertRows = [];
  const multiRecipeInputs = [];

  for (const fam of FOOD_FAMILIES) {
    for (const out of fam.outputs) {
      const posItem = posByName.get(out.name.trim().toUpperCase());
      if (!posItem) {
        throw new Error(`POS item "${out.name}" not found in Kaplong!`);
      }

      const ratio = fam.raw_qty > 0 ? (out.qty / fam.raw_qty) : out.qty;
      const recipeName = out.recipe_title || `${fam.raw_name} to ${posItem.name}`;

      const row = {
        branch_id: KAPLONG_BRANCH_ID,
        recipe_name: recipeName,
        raw_item_sku: fam.raw_sku,
        raw_item_name: fam.raw_name,
        raw_quantity: fam.raw_qty,
        raw_unit: fam.raw_unit,
        produced_item_name: posItem.name,
        produced_item_sku: null,
        produced_quantity: out.qty,
        produced_unit: 'pcs',
        pos_outlet_item_id: posItem.id,
        is_active: true,
        allowed_variance_percent: 2,
        spoilage_threshold_percent: 1,
        requires_yield_confirmation: true,
        yield_type_code: fam.yield_type,
        stocktake_control_mode: fam.stocktake_mode,
        stocktake_location: fam.stocktake_loc,
        updated_at: new Date().toISOString()
      };

      allInsertRows.push({ row, inputs: out.inputs });
    }
  }

  console.log(`Prepared ${allInsertRows.length} recipe standards.`);

  // 2. Upsert in batches of 30 to avoid payload limits
  const batchSize = 30;
  for (let i = 0; i < allInsertRows.length; i += batchSize) {
    const chunk = allInsertRows.slice(i, i + batchSize);
    const rows = chunk.map(c => c.row);
    const { data: upserted, error: upsertErr } = await supabase
      .from('kitchen_production_recipes')
      .upsert(rows, { onConflict: 'branch_id,raw_item_sku,produced_item_name' })
      .select('id, raw_item_sku, produced_item_name');

    if (upsertErr) {
      console.error('Upsert error:', upsertErr);
      throw upsertErr;
    }

    // Map upserted IDs to recipe inputs
    if (upserted) {
      for (const item of chunk) {
        const matched = upserted.find(u => u.raw_item_sku === item.row.raw_item_sku && u.produced_item_name === item.row.produced_item_name);
        if (matched) {
          if (item.inputs && item.inputs.length > 0) {
            multiRecipeInputs.push({ recipeId: matched.id, inputs: item.inputs });
          } else if (item.row.raw_item_sku && item.row.raw_item_sku !== 'MULTI') {
            multiRecipeInputs.push({
              recipeId: matched.id,
              inputs: [{
                sku: item.row.raw_item_sku,
                name: item.row.raw_item_name,
                qty: item.row.raw_quantity,
                unit: item.row.raw_unit
              }]
            });
          }
        }
      }
    }
  }

  console.log('Successfully upserted all kitchen production recipes.');

  // 3. Insert inputs for ALL recipes into kitchen_production_recipe_inputs
  if (multiRecipeInputs.length > 0) {
    console.log(`Inserting inputs for ${multiRecipeInputs.length} recipe standards...`);
    const recipeIds = multiRecipeInputs.map(m => m.recipeId);
    await supabase.from('kitchen_production_recipe_inputs').delete().in('recipe_id', recipeIds);

    const inputRows = [];
    for (const m of multiRecipeInputs) {
      for (const inp of m.inputs) {
        inputRows.push({
          recipe_id: m.recipeId,
          raw_item_sku: inp.sku,
          raw_item_name: inp.name,
          quantity: inp.qty,
          unit: inp.unit
        });
      }
    }

    // Insert in batches of 50
    for (let i = 0; i < inputRows.length; i += 50) {
      const chunk = inputRows.slice(i, i + 50);
      const { error: inpErr } = await supabase.from('kitchen_production_recipe_inputs').insert(chunk);
      if (inpErr) {
        console.error('Error inserting recipe inputs:', inpErr);
        throw inpErr;
      }
    }
    console.log(`Inserted ${inputRows.length} total recipe ingredient inputs.`);
  }

  // 4. Configure Direct Items (food_control_direct_items)
  console.log('4. Configuring Food Control Direct Items for Kaplong...');
  await supabase.from('food_control_direct_items').delete().eq('branch_id', KAPLONG_BRANCH_ID);

  const directItemsMap = [
    { sku: 'FG-70', name: 'Water 500ml', posName: 'DASANI 500ML' },
    { sku: 'FG-417', name: 'Water 1L', posName: 'DASANI 1 LTR' },
    { sku: 'FGH-CBV-0001', name: 'Soda 300ml', posName: 'SODA 300ML' },
    { sku: 'FG-447', name: 'MINUTE MAID', posName: 'MINUTE MAID' },
  ];

  const directRows = [];
  for (const d of directItemsMap) {
    const pos = posByName.get(d.posName.toUpperCase());
    if (pos) {
      directRows.push({
        branch_id: KAPLONG_BRANCH_ID,
        stock_item_sku: d.sku,
        stock_item_name: d.name,
        pos_outlet_item_id: pos.id,
        is_active: true,
        updated_at: new Date().toISOString()
      });
    }
  }

  if (directRows.length > 0) {
    const { error: dErr } = await supabase.from('food_control_direct_items').insert(directRows);
    if (dErr) console.warn('Direct item insert error:', dErr.message);
    else console.log(`Configured ${directRows.length} direct items.`);
  }

  // 5. Copy Channel Food Standards from Bomet Town
  console.log('5. Copying Channel Food Standards from Bomet Town...');
  const { data: bometChannels, error: bometChErr } = await supabase
    .from('channel_food_standards')
    .select('channel, raw_item_sku, raw_item_name, quantity_per_pax, unit, package_name, package_definition_id')
    .eq('branch_id', 2);

  if (bometChErr) {
    console.error('Error reading Bomet channel standards:', bometChErr);
  } else if (bometChannels && bometChannels.length > 0) {
    // Delete existing for Kaplong
    await supabase.from('channel_food_standards').delete().eq('branch_id', KAPLONG_BRANCH_ID);

    const kaplongChannels = bometChannels.map(c => ({
      branch_id: KAPLONG_BRANCH_ID,
      channel: c.channel,
      raw_item_sku: c.raw_item_sku,
      raw_item_name: c.raw_item_name,
      quantity_per_pax: c.quantity_per_pax,
      unit: c.unit,
      package_name: c.package_name,
      package_definition_id: c.package_definition_id
    }));

    const { error: chInsErr } = await supabase.from('channel_food_standards').insert(kaplongChannels);
    if (chInsErr) {
      console.error('Error inserting channel food standards:', chInsErr);
    } else {
      console.log(`Copied ${kaplongChannels.length} channel food standards to Kaplong.`);
    }
  }

  console.log('\n======================================================');
  console.log('✅ ALL FOOD CONTROL STANDARDS SUCCESSFULLY APPLIED TO KAPLONG!');
  console.log('======================================================');
}

applyFoodControlStandards().catch(err => {
  console.error('Fatal error applying food standards:', err);
  process.exit(1);
});
