require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const KAPLONG_BRANCH_ID = 3;
const KAPLONG_RESTAURANT_OUTLET_ID = '9ebb1fc0-1716-4db7-80e8-6c727a05213c';

const menuData = [
  // Goat (Mbuzi) & Offal (25)
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG LIVER', price: 1000 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 MATUMBO', price: 600 },
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG MATUMBO', price: 1000 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 MBUZI BOIL TUMBUKIZA', price: 700 },
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG MBUZI BOIL TUMBUKIZA', price: 1500 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 MBUZI CHOMA', price: 650 },
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG MBUZI CHOMA', price: 1200 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 MBUZI WET FRY', price: 700 },
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG MBUZI PAN FRY', price: 1300 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 PAN FRY MBUZI CHOMA', price: 650 },
  { category: 'Goat (Mbuzi) & Offal', name: '1 KG MBUZI WET FRY', price: 1300 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 LIVER', price: 300 },
  { category: 'Goat (Mbuzi) & Offal', name: '1KG TUMBUKIZA', price: 1500 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 MATUMBO FRY', price: 300 },
  { category: 'Goat (Mbuzi) & Offal', name: '3/4 LIVER', price: 750 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 MBUZI BOIL TUMBUKIZA', price: 400 },
  { category: 'Goat (Mbuzi) & Offal', name: '3/4 MBUZI BOIL TUMBUKIZA', price: 900 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 MBUZI CHOMA', price: 350 },
  { category: 'Goat (Mbuzi) & Offal', name: '3/4 MBUZI CHOMA', price: 900 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 MBUZI PAN FRY', price: 350 },
  { category: 'Goat (Mbuzi) & Offal', name: '3/4 MBUZI PAN FRY', price: 900 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 MBUZI WET FRY', price: 350 },
  { category: 'Goat (Mbuzi) & Offal', name: '3/4 MBUZI WET FRY', price: 900 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/4 PAN FRY MBUZI CHOMA', price: 350 },
  { category: 'Goat (Mbuzi) & Offal', name: '1/2 LIVER', price: 550 },

  // Beef & Pork (6)
  { category: 'Beef & Pork', name: '1KG BEEF STEW/WET FRY', price: 1200 },
  { category: 'Beef & Pork', name: '1/4 BEEF WET FRY', price: 350 },
  { category: 'Beef & Pork', name: '1/2 BEEF WET FRY', price: 650 },
  { category: 'Beef & Pork', name: 'BEEF CURRY', price: 400 },
  { category: 'Beef & Pork', name: '1/4 BEEF STEW', price: 350 },
  { category: 'Beef & Pork', name: 'PORKCHOP (B)', price: 650 },

  // Chicken - Broiler (18)
  { category: 'Chicken - Broiler', name: 'FULL CHICKEN FRY/WET BROILER', price: 1400 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN CHOMA BROILER', price: 400 },
  { category: 'Chicken - Broiler', name: '1/2 CHICKEN LOLLIPOP', price: 800 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN CURRY/MASALA BROILER', price: 450 },
  { category: 'Chicken - Broiler', name: '1/2 CHICKEN BYRIANI', price: 1200 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN FRIED BROILER', price: 400 },
  { category: 'Chicken - Broiler', name: '1/2 FRIED CHICKEN BROILER', price: 700 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN LOLLIPOP', price: 450 },
  { category: 'Chicken - Broiler', name: '1/2 PAN FRIED CHICKEN BROILER', price: 750 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN MARYLAND', price: 400 },
  { category: 'Chicken - Broiler', name: '1/2 PLAIN CHICKEN BROILER', price: 700 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN PLAIN BROILER', price: 350 },
  { category: 'Chicken - Broiler', name: '1/2 WET FRY CHICKEN BROILER', price: 800 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN SPECIAL BROILER', price: 450 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN BONELESS', price: 400 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN WET FRY BROILER', price: 400 },
  { category: 'Chicken - Broiler', name: '1/4 CHICKEN BYRIANI BROILER', price: 600 },
  { category: 'Chicken - Broiler', name: 'CHICKEN BERBEQUE', price: 600 },

  // Chicken - Kienyeji (12)
  { category: 'Chicken - Kienyeji', name: 'FULL CHICKEN KIENYEJI', price: 1800 },
  { category: 'Chicken - Kienyeji', name: '1/2 WET FRY CHICKEN KIENYEJI', price: 1000 },
  { category: 'Chicken - Kienyeji', name: '3/4 WET FRY CHICKEN KIENYEJI', price: 1300 },
  { category: 'Chicken - Kienyeji', name: '1/4 CHICKEN SPECIAL KIENYEJI', price: 600 },
  { category: 'Chicken - Kienyeji', name: '1/2 FRIED CHICKEN KIENYEJI', price: 900 },
  { category: 'Chicken - Kienyeji', name: '1/4 FRY CHICKEN KIENYEJI', price: 500 },
  { category: 'Chicken - Kienyeji', name: '1/2 MASALA CHICKEN KIENYEJI', price: 900 },
  { category: 'Chicken - Kienyeji', name: '1/4 MASALA CHICKEN KIENYEJI', price: 500 },
  { category: 'Chicken - Kienyeji', name: '1/2 PAN FRIED CHICKEN KIENYEJI', price: 900 },
  { category: 'Chicken - Kienyeji', name: '1/4 PAN FRY CHICKEN KIENYEJI', price: 500 },
  { category: 'Chicken - Kienyeji', name: '1/2 PAN FRY CHICKEN KIENYEJI', price: 900 },
  { category: 'Chicken - Kienyeji', name: '1/4 WET FRY CHICKEN KIENYEJI', price: 550 },

  // Fish (9)
  { category: 'Fish', name: 'BOILED FISH', price: 600 },
  { category: 'Fish', name: 'FISH MASALA', price: 600 },
  { category: 'Fish', name: 'COCONUT FISH', price: 600 },
  { category: 'Fish', name: 'FISH STEW', price: 550 },
  { category: 'Fish', name: 'FISH CURRY', price: 600 },
  { category: 'Fish', name: 'FISH WET FRY', price: 550 },
  { category: 'Fish', name: 'FISH DRY', price: 550 },
  { category: 'Fish', name: 'OMENA', price: 150 },
  { category: 'Fish', name: 'FISH FILLET', price: 600 },

  // Sausages & Kebabs (6)
  { category: 'Sausages & Kebabs', name: 'KEBAB', price: 80 },
  { category: 'Sausages & Kebabs', name: 'SAUSAGE BITES', price: 80 },
  { category: 'Sausages & Kebabs', name: 'KEBAB SPECIAL', price: 180 },
  { category: 'Sausages & Kebabs', name: 'SAUSAGE SPECIAL', price: 150 },
  { category: 'Sausages & Kebabs', name: 'SAUSAGE', price: 60 },
  { category: 'Sausages & Kebabs', name: 'SMOKIE (B)', price: 50 },

  // Platters (5)
  { category: 'Platters', name: 'PLATTER FOR 2', price: 1500 },
  { category: 'Platters', name: 'PLATTER FOR 6', price: 6000 },
  { category: 'Platters', name: 'PLATTER FOR 3', price: 2400 },
  { category: 'Platters', name: 'PLATTER FOR 9', price: 9000 },
  { category: 'Platters', name: 'PLATTER FOR 4', price: 4000 },

  // Traditional Dishes (16)
  { category: 'Traditional Dishes', name: 'BEANS', price: 100 },
  { category: 'Traditional Dishes', name: 'MATOKE SPECIAL', price: 200 },
  { category: 'Traditional Dishes', name: 'GITHERI', price: 150 },
  { category: 'Traditional Dishes', name: 'MINJI', price: 220 },
  { category: 'Traditional Dishes', name: 'GITHERI SPECIAL', price: 250 },
  { category: 'Traditional Dishes', name: 'MINJI SPECIAL', price: 300 },
  { category: 'Traditional Dishes', name: 'MANAGU', price: 100 },
  { category: 'Traditional Dishes', name: 'NDEREMA', price: 150 },
  { category: 'Traditional Dishes', name: 'MANAGU SPECIAL', price: 200 },
  { category: 'Traditional Dishes', name: 'NDEREMA MIX', price: 230 },
  { category: 'Traditional Dishes', name: 'MANAGU MIX', price: 150 },
  { category: 'Traditional Dishes', name: 'NDUMA', price: 80 },
  { category: 'Traditional Dishes', name: 'MANAGU MIX SPECIAL', price: 250 },
  { category: 'Traditional Dishes', name: 'SAGAA', price: 100 },
  { category: 'Traditional Dishes', name: 'MANAGU MIX SPECIAL/CHAPO', price: 250 },
  { category: 'Traditional Dishes', name: 'SAGAA MIX', price: 150 },

  // Rice, Ugali & Pasta (10)
  { category: 'Rice, Ugali & Pasta', name: 'PILAU', price: 200 },
  { category: 'Rice, Ugali & Pasta', name: 'SPHAGETI', price: 170 },
  { category: 'Rice, Ugali & Pasta', name: 'PILAU PLAIN', price: 200 },
  { category: 'Rice, Ugali & Pasta', name: 'UGALI', price: 50 },
  { category: 'Rice, Ugali & Pasta', name: 'PILAU SPECIAL', price: 250 },
  { category: 'Rice, Ugali & Pasta', name: 'UGALI BROWN', price: 100 },
  { category: 'Rice, Ugali & Pasta', name: 'RICE', price: 100 },
  { category: 'Rice, Ugali & Pasta', name: 'VEGETABLE RICE', price: 200 },
  { category: 'Rice, Ugali & Pasta', name: 'RICE SPECIAL', price: 250 },
  { category: 'Rice, Ugali & Pasta', name: 'VEGETABLE RICE SPECIAL', price: 250 },

  // Potatoes & Chips (10)
  { category: 'Potatoes & Chips', name: 'BOILED POTATOES', price: 100 },
  { category: 'Potatoes & Chips', name: 'PCUISSINS CHIPS', price: 300 },
  { category: 'Potatoes & Chips', name: 'CHIPS', price: 200 },
  { category: 'Potatoes & Chips', name: 'POTATOE WEDGES', price: 250 },
  { category: 'Potatoes & Chips', name: 'CHIPS MASALA', price: 250 },
  { category: 'Potatoes & Chips', name: 'ROAST POTATOES', price: 150 },
  { category: 'Potatoes & Chips', name: 'GARLIC CHIPS', price: 250 },
  { category: 'Potatoes & Chips', name: 'SOUTE POTATOES (B)', price: 200 },
  { category: 'Potatoes & Chips', name: 'MASHED POTATOES', price: 150 },
  { category: 'Potatoes & Chips', name: 'SWEET POTATOES', price: 50 },

  // Vegetables & Salads (10)
  { category: 'Vegetables & Salads', name: 'CABBAGE', price: 50 },
  { category: 'Vegetables & Salads', name: 'SPECIAL CABBAGE/SUKUMA', price: 100 },
  { category: 'Vegetables & Salads', name: 'KACHUMBARI', price: 50 },
  { category: 'Vegetables & Salads', name: 'SPINACH', price: 120 },
  { category: 'Vegetables & Salads', name: 'MIX CABBAGE/SUKUMA', price: 150 },
  { category: 'Vegetables & Salads', name: 'SUKUMA', price: 50 },
  { category: 'Vegetables & Salads', name: 'MIX SKUMA/CABBAGE', price: 100 },
  { category: 'Vegetables & Salads', name: 'SUKUMA MIXED SPECIAL', price: 200 },
  { category: 'Vegetables & Salads', name: 'MIXED VEGETABLE', price: 250 },
  { category: 'Vegetables & Salads', name: 'VEGETABLE SALAD', price: 50 },

  // Soups & Sauce (4)
  { category: 'Soups & Sauce', name: 'BUTTERNUT SOUP', price: 150 },
  { category: 'Soups & Sauce', name: 'SOUP', price: 50 },
  { category: 'Soups & Sauce', name: 'SAUCE', price: 50 },
  { category: 'Soups & Sauce', name: 'SOUP SPECIAL', price: 150 },

  // Eggs (12)
  { category: 'Eggs', name: 'BOILED EGG', price: 100 },
  { category: 'Eggs', name: 'FRIED EGG (KIENYEJI)', price: 110 },
  { category: 'Eggs', name: 'BOILED EGG 1', price: 50 },
  { category: 'Eggs', name: 'SCRAMBLED EGGS(BROILER)', price: 100 },
  { category: 'Eggs', name: 'EGG SPECIAL BROILER', price: 180 },
  { category: 'Eggs', name: 'SCRAMBLED EGGS(KIENYEJI)', price: 150 },
  { category: 'Eggs', name: 'EGG SPECIAL KIENYEJI', price: 200 },
  { category: 'Eggs', name: 'SPANISH OMELLETE', price: 120 },
  { category: 'Eggs', name: 'EGGS FRY MACHO', price: 150 },
  { category: 'Eggs', name: 'SPANISH OMELLETE (BROILER)', price: 150 },
  { category: 'Eggs', name: 'FRIED EGG (BROILER)', price: 80 },
  { category: 'Eggs', name: 'SPANISH OMELLETE (KIENYEJI)', price: 200 },

  // Breakfast (10)
  { category: 'Breakfast', name: 'BEST BREAKFAST', price: 400 },
  { category: 'Breakfast', name: 'CORN FLAKES', price: 50 },
  { category: 'Breakfast', name: 'VIP BREAKFAST', price: 500 },
  { category: 'Breakfast', name: 'CORNFLAKES', price: 50 },
  { category: 'Breakfast', name: 'CONTINENTAL BREAKFAST', price: 600 },
  { category: 'Breakfast', name: 'FRENCH TOAST', price: 100 },
  { category: 'Breakfast', name: 'PORRIDGE', price: 100 },
  { category: 'Breakfast', name: 'PANCAKE PAIR', price: 100 },
  { category: 'Breakfast', name: 'PORRIDGE/HONEY', price: 150 },
  { category: 'Breakfast', name: 'TOASTED BREAD', price: 50 },

  // Bakery & Chapati (12)
  { category: 'Bakery & Chapati', name: 'BREAD ROLLS', price: 50 },
  { category: 'Bakery & Chapati', name: 'HALF CAKE', price: 50 },
  { category: 'Bakery & Chapati', name: 'CROISSANTS', price: 50 },
  { category: 'Bakery & Chapati', name: 'MARBLE CAKE', price: 100 },
  { category: 'Bakery & Chapati', name: 'SCONES', price: 70 },
  { category: 'Bakery & Chapati', name: 'CHAPATI WHITE', price: 50 },
  { category: 'Bakery & Chapati', name: 'DOUGHNUT', price: 50 },
  { category: 'Bakery & Chapati', name: 'CHAPATI BROWN', price: 70 },
  { category: 'Bakery & Chapati', name: 'NDAZI', price: 50 },
  { category: 'Bakery & Chapati', name: 'DRIED CHAPATI', price: 70 },
  { category: 'Bakery & Chapati', name: 'COOKIES (PAIR)', price: 50 },
  { category: 'Bakery & Chapati', name: 'SPECIAL CHAPATI', price: 200 },

  // Fast Food & Snacks (8)
  { category: 'Fast Food & Snacks', name: 'PIZZA', price: 1000 },
  { category: 'Fast Food & Snacks', name: 'VEGETABLE SANDWICH', price: 150 },
  { category: 'Fast Food & Snacks', name: 'BEEF BURGER', price: 300 },
  { category: 'Fast Food & Snacks', name: 'SAMOSA', price: 50 },
  { category: 'Fast Food & Snacks', name: 'CHICKEN SANDWICH', price: 550 },
  { category: 'Fast Food & Snacks', name: 'SAMOSA SPECIAL', price: 150 },
  { category: 'Fast Food & Snacks', name: 'EGG SANDWICH', price: 150 },
  { category: 'Fast Food & Snacks', name: 'BHAJIA', price: 250 },

  // Fruit (4)
  { category: 'Fruit', name: 'BANANA', price: 10 },
  { category: 'Fruit', name: 'FRUIT SALAD PLATTER', price: 250 },
  { category: 'Fruit', name: 'MANGOES', price: 40 },
  { category: 'Fruit', name: 'FRUIT SALADS/BUDDINGS', price: 150 },

  // Tea (24)
  { category: 'Tea', name: 'BLACK TEA', price: 40 },
  { category: 'Tea', name: 'GINGER TEA MUG', price: 50 },
  { category: 'Tea', name: 'BLACK TEA POT', price: 80 },
  { category: 'Tea', name: 'GINGER TEA POT', price: 100 },
  { category: 'Tea', name: 'TEA MUG', price: 50 },
  { category: 'Tea', name: 'LEMON TEA MUG', price: 50 },
  { category: 'Tea', name: 'TEA POT', price: 100 },
  { category: 'Tea', name: 'LEMON TEA & HONEY MUG', price: 150 },
  { category: 'Tea', name: 'TEA MUG WITH GINGER', price: 100 },
  { category: 'Tea', name: 'LEMON TEA POT/HONEY', price: 150 },
  { category: 'Tea', name: 'ENGLISH/NILON TEA', price: 100 },
  { category: 'Tea', name: 'CINNAMON TEA WITH HONEY', price: 150 },
  { category: 'Tea', name: 'TEA MASALA MUG', price: 60 },
  { category: 'Tea', name: 'TUMERIC TEA WITH HONEY (C)', price: 150 },
  { category: 'Tea', name: 'TEA MASALA POT', price: 120 },
  { category: 'Tea', name: 'HIBISCUS', price: 50 },
  { category: 'Tea', name: 'SPECIAL TEA MUG', price: 80 },
  { category: 'Tea', name: 'HONEY PLAIN', price: 50 },
  { category: 'Tea', name: 'SPECIAL TEA POT', price: 150 },
  { category: 'Tea', name: 'HOT LEMON', price: 50 },
  { category: 'Tea', name: 'SPECIAL TEA POT 1L', price: 200 },
  { category: 'Tea', name: 'DAWA/CONCOTIN POT', price: 200 },
  { category: 'Tea', name: 'SPECIAL TEA MASALA POT', price: 170 },
  { category: 'Tea', name: 'GINGER SHOTS', price: 200 },

  // Tea Flasks (3)
  { category: 'Tea Flasks', name: 'TEA FLASK MEDIUM', price: 200 },
  { category: 'Tea Flasks', name: 'TEA FLASK XTRA LARGE', price: 450 },
  { category: 'Tea Flasks', name: 'TEA FLASK LARGE', price: 300 },

  // Coffee (7)
  { category: 'Coffee', name: 'BLACK COFFEE MUG', price: 50 },
  { category: 'Coffee', name: 'LEMON COFFEE', price: 100 },
  { category: 'Coffee', name: 'BLACK COFFEE POT', price: 100 },
  { category: 'Coffee', name: 'LEMON COFFEE POT', price: 200 },
  { category: 'Coffee', name: 'WHITE COFFEE MUG', price: 60 },
  { category: 'Coffee', name: 'NESCAFE SATCHET', price: 20 },
  { category: 'Coffee', name: 'WHITE COFFEE POT', price: 120 },

  // Chocolate & Milo (4)
  { category: 'Chocolate & Milo', name: 'BLACK CHOCOLATE MUG', price: 60 },
  { category: 'Chocolate & Milo', name: 'WHITE MILO MUG', price: 70 },
  { category: 'Chocolate & Milo', name: 'BLACK MILO MUG', price: 50 },
  { category: 'Chocolate & Milo', name: 'WHITE MILO POT', price: 140 },

  // Soda (8)
  { category: 'Soda', name: 'SODA 300ML', price: 70 },
  { category: 'Soda', name: 'COKE ZERO', price: 100 },
  { category: 'Soda', name: 'SODA 500ML', price: 100 },
  { category: 'Soda', name: 'TONIC SODA CAN', price: 150 },
  { category: 'Soda', name: 'SODA 500ML TAKE AWAY', price: 100 },
  { category: 'Soda', name: 'NOVIDA', price: 100 },
  { category: 'Soda', name: 'SODA TAKEAWAY', price: 100 },
  { category: 'Soda', name: 'ALVARO', price: 200 },

  // Energy Drinks (5)
  { category: 'Energy Drinks', name: 'REDBULL', price: 300 },
  { category: 'Energy Drinks', name: 'QUARANA', price: 250 },
  { category: 'Energy Drinks', name: 'MONSTER', price: 350 },
  { category: 'Energy Drinks', name: 'PREDATOR CAN', price: 100 },
  { category: 'Energy Drinks', name: 'GUARANA', price: 250 },

  // Juice (6)
  { category: 'Juice', name: 'MINUTE MAID', price: 120 },
  { category: 'Juice', name: 'LIME LEMONADE', price: 100 },
  { category: 'Juice', name: 'DELMONTE', price: 350 },
  { category: 'Juice', name: 'PUNCH', price: 250 },
  { category: 'Juice', name: 'FRESH COCKTAIL/MANGO', price: 150 },
  { category: 'Juice', name: 'LEMON (B)', price: 20 },

  // Water (6)
  { category: 'Water', name: 'DASANI 500ML', price: 50 },
  { category: 'Water', name: 'DASANI 1L', price: 100 },
  { category: 'Water', name: 'DASANI 500ML.', price: 50 },
  { category: 'Water', name: 'KERINGET 500ML', price: 70 },
  { category: 'Water', name: 'DASANI 1 LTR', price: 100 },
  { category: 'Water', name: 'KERINGET 1 LTR', price: 150 },

  // Milk & Dairy (6)
  { category: 'Milk & Dairy', name: 'FRESH MILK 500ML', price: 150 },
  { category: 'Milk & Dairy', name: 'MILK SHAKE', price: 300 },
  { category: 'Milk & Dairy', name: 'GLASS MILK SMALL', price: 50 },
  { category: 'Milk & Dairy', name: 'MURSIK GLASS', price: 100 },
  { category: 'Milk & Dairy', name: 'GLASS MILK LARGE', price: 100 },
  { category: 'Milk & Dairy', name: 'MURSIK 1L', price: 260 }
];

async function setupKaplongMenu() {
  console.log(`Starting Kaplong Restaurant Menu setup... Total items: ${menuData.length}`);

  // Confirm Outlet exists and is Kaplong
  const { data: outlet, error: oErr } = await supabase
    .from('pos_outlets')
    .select('*')
    .eq('id', KAPLONG_RESTAURANT_OUTLET_ID)
    .single();

  if (oErr || !outlet || outlet.branch_id !== KAPLONG_BRANCH_ID) {
    console.error("FATAL: Target outlet does not match Kaplong branch! Aborting.");
    process.exit(1);
  }

  console.log(`Confirmed target outlet: ${outlet.name} (branch_id: ${outlet.branch_id})`);

  // Transform data to pos_outlet_items records
  const records = menuData.map((item, index) => {
    const skuIndex = String(index + 1).padStart(4, '0');
    return {
      outlet_id: KAPLONG_RESTAURANT_OUTLET_ID,
      branch_id: KAPLONG_BRANCH_ID,
      name: item.name,
      category: item.category,
      selling_price: item.price,
      cost_price: 0,
      current_stock: 0,
      reserved_stock: 0,
      low_stock_level: 0,
      opening_stock: 0,
      track_stock: false, // NOT TO BE TRACKED
      is_active: true,    // ACTIVE
      is_available: true, // AVAILABLE
      status: 'active',   // ACTIVE
      unit: 'each',
      source_table: 'manual',
      sku: `KPL-RT-${skuIndex}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  // Check if any items already exist for this outlet
  const { data: existingItems } = await supabase
    .from('pos_outlet_items')
    .select('id, name')
    .eq('outlet_id', KAPLONG_RESTAURANT_OUTLET_ID);

  if (existingItems && existingItems.length > 0) {
    console.log(`Found ${existingItems.length} existing items in Kaplong Restaurant POS. Deleting before fresh setup...`);
    const { error: delErr } = await supabase
      .from('pos_outlet_items')
      .delete()
      .eq('outlet_id', KAPLONG_RESTAURANT_OUTLET_ID);
    if (delErr) {
      console.error("Error clearing existing items:", delErr);
      process.exit(1);
    }
    console.log("Cleared existing items.");
  }

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('pos_outlet_items')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
      process.exit(1);
    }
    insertedCount += data.length;
    console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${data.length} items (Total so far: ${insertedCount})`);
  }

  console.log(`\nSUCCESS! Successfully inserted ${insertedCount} menu items for Kaplong Restaurant POS Outlet.`);

  // Verify counts in DB
  const { data: verifyItems, error: vErr } = await supabase
    .from('pos_outlet_items')
    .select('id, category, track_stock, is_active, status, branch_id, outlet_id')
    .eq('outlet_id', KAPLONG_RESTAURANT_OUTLET_ID);

  console.log(`\nVerification: Found ${verifyItems.length} items in DB for Kaplong Restaurant Outlet.`);
  const catSummary = {};
  let allUntracked = true;
  let allActive = true;
  let allKaplongBranch = true;

  verifyItems.forEach(item => {
    catSummary[item.category] = (catSummary[item.category] || 0) + 1;
    if (item.track_stock !== false) allUntracked = false;
    if (item.is_active !== true || item.status !== 'active') allActive = false;
    if (item.branch_id !== 3) allKaplongBranch = false;
  });

  console.log("\nCategories in DB:", catSummary);
  console.log("All items untracked (track_stock=false):", allUntracked);
  console.log("All items active (is_active=true & status='active'):", allActive);
  console.log("All items exclusively on Kaplong branch (branch_id=3):", allKaplongBranch);
}

setupKaplongMenu().catch(console.error);
