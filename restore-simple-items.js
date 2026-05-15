require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function restoreSimpleItems() {
  console.log('🔄 RESTORING SIMPLE ITEMS DATA\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Get branch ID
    const branchResult = await client.query('SELECT id FROM branches LIMIT 1');
    const branchId = branchResult.rows[0]?.id;
    console.log(`Using branch_id: ${branchId}\n`);
    
    // Inventory data from JSON
    const inventoryData = [
      // Dry Goods
      { item_name: "Gas Cylinder 13KG", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 2400, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "500ML Water", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 21, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Gas Cylinder 50KG", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 8500, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Gas Cylinder 6KG", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 1050, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Gas Cylinder 6KG", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 1250, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Air Fresheners", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 1980, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Ajab Ugali", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 265, reorder_level_qty: 40, reorder_level_unit: "bales" },
      { item_name: "Attarmark", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 1284, reorder_level_qty: 2, reorder_level_unit: "bales" },
      { item_name: "Bacon", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 350, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Baked Beans", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 400, reorder_level_qty: 44, reorder_level_unit: "pcs" },
      { item_name: "Baking Powder", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 20, reorder_level_qty: 1, reorder_level_unit: "ctn" },
      { item_name: "Bananas", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 10, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Bar Soap", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 180, reorder_level_qty: 3, reorder_level_unit: "ctns" },
      { item_name: "Batteries AA", category: "Maintenance", subcategory: "Electrical", unit_price_kes: 70, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Batteries AAA", category: "Maintenance", subcategory: "Electrical", unit_price_kes: 50, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Baygon 2x", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 850, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Beef Masala", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 250, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Beef Steak", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 680, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Bella Tissue", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 32.5, reorder_level_qty: 55, reorder_level_unit: "bales" },
      { item_name: "Bicarbonate of Soda", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 45, reorder_level_qty: 1, reorder_level_unit: "ctn" },
      { item_name: "Biro Pens", category: "Administration", subcategory: "Stationery", unit_price_kes: 10, reorder_level_qty: 1, reorder_level_unit: "ctn" },
      { item_name: "Black Pepper", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 12, reorder_level_unit: "pcs" },
      { item_name: "Blue Band", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 2970, reorder_level_qty: 10, reorder_level_unit: "ctns" },
      { item_name: "Broccoli", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 60, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Broilers Eggs", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 600, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Broilers", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 450, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Brooms", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 50, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Brown Bread", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 57, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Brown Kiaki", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Butternut", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 80, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Cabbages", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 45, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Captain Morgan Lemon", category: "Food & Beverage", subcategory: "Bar Stock-Alcoholic", unit_price_kes: 384, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Captain Morgan Lemon Flavored", category: "Food & Beverage", subcategory: "Bar Stock-Alcoholic", unit_price_kes: 1080, reorder_level_qty: 250, reorder_level_unit: "ml" },
      { item_name: "Cardamoms", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Carrier Bags #15", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 85, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Carrier Bags #22", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 125, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Carrots", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 30, reorder_level_qty: 140, reorder_level_unit: "kgs" },
      { item_name: "Charcoal", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 1450, reorder_level_qty: 10, reorder_level_unit: "sacks" },
      { item_name: "Chicken Bites", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 375, reorder_level_qty: 10, reorder_level_unit: "pcs" },
      { item_name: "Chicken Masala", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 250, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Chilli Sauce", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 450, reorder_level_qty: 15, reorder_level_unit: "pcs" },
      { item_name: "Chilli Sauce Sachets", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 900, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Cinnamon", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 230, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Coconut Cream", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 290, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Coconut Milk", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 285, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Coffee Cups", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 375, reorder_level_qty: 5, reorder_level_unit: "pcs" },
      { item_name: "Colgate", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 800, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Cooking Oil", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 4600, reorder_level_qty: 60, reorder_level_unit: "cans" },
      { item_name: "Corn Flour", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 107, reorder_level_qty: 30, reorder_level_unit: "tns" },
      { item_name: "Cornflakes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 350, reorder_level_qty: 10, reorder_level_unit: "pkts" },
      { item_name: "Cotton", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 200, reorder_level_qty: 12, reorder_level_unit: "pkts" },
      { item_name: "Courgettes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 40, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Cucumbers", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 40, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Curry Powder", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 250, reorder_level_qty: 12, reorder_level_unit: "pcs" },
      { item_name: "Dana Jeera", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 215, reorder_level_qty: 12, reorder_level_unit: "pcs" },
      { item_name: "Coriander (Dania)", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Dark Soy Sauce", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 350, reorder_level_qty: 3, reorder_level_unit: "ctns" },
      { item_name: "Dettol", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 225, reorder_level_qty: 40, reorder_level_unit: "lts" },
      { item_name: "Dhania (Coriander)", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Doom Y", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 300, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Dormants Coffee", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 500, reorder_level_qty: 2, reorder_level_unit: "ctns" },
      { item_name: "Downy Liquid Soap", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 100, reorder_level_qty: 60, reorder_level_unit: "ltrs" },
      { item_name: "Drinking Chocolate", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 30, reorder_level_qty: 1, reorder_level_unit: "ctn" },
      { item_name: "Easy Warm", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 800, reorder_level_qty: 30, reorder_level_unit: "pcs" },
      { item_name: "Egg Yellow", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 60, reorder_level_qty: 60, reorder_level_unit: "pcs" },
      { item_name: "Eggs Kienyeji", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 25, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Envelope A4", category: "Administration", subcategory: "Stationery", unit_price_kes: 10, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Envelope A5", category: "Administration", subcategory: "Stationery", unit_price_kes: 5, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Exe All Purpose", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 155, reorder_level_qty: 20, reorder_level_unit: "bales" },
      { item_name: "Famila Wimbi", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 700, reorder_level_qty: 1, reorder_level_unit: "bale" },
      { item_name: "Fish", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 280, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Fish Fillets", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 275, reorder_level_qty: 1, reorder_level_unit: "kg" },
      { item_name: "Fish Masala", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Foil", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 1400, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Garam Masala", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 190, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Garlic", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 25, reorder_level_qty: 200, reorder_level_unit: "pcs" },
      { item_name: "Garlic Powder", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 180, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Ginger", category: "Food & Beverage", subcategory: "Bar Stock-Alcoholic", unit_price_kes: 250, reorder_level_qty: 20, reorder_level_unit: "kgs" },
      { item_name: "Ginger Powder", category: "Food & Beverage", subcategory: "Bar Stock-Alcoholic", unit_price_kes: 150, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Gram Flour", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 450, reorder_level_qty: 2, reorder_level_unit: "pkts" },
      { item_name: "Hairnets", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 1, reorder_level_qty: 200, reorder_level_unit: "pcs" },
      { item_name: "Hand Towels", category: "Housekeeping", subcategory: "Towels & Robes", unit_price_kes: 162, reorder_level_qty: 5, reorder_level_unit: "bales" },
      { item_name: "Hand Wash", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 60, reorder_level_qty: 100, reorder_level_unit: "ltrs" },
      { item_name: "Hannan Tissue", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 35, reorder_level_qty: 300, reorder_level_unit: "pcs" },
      { item_name: "Harpic", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 160, reorder_level_qty: 20, reorder_level_unit: "ltrs" },
      { item_name: "Hoho (Green Pepper)", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 10, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Honey Carton", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 2700, reorder_level_qty: 50, reorder_level_unit: "ctn" },
      { item_name: "Honey Pieces", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "IDP", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 1150, reorder_level_qty: 15, reorder_level_unit: "bales" },
      { item_name: "Jik", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 100, reorder_level_qty: 1000, reorder_level_unit: "ltrs" },
      { item_name: "Juice Straws", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 180, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Jumbo Tissue", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 105, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Kamande (Cereal)", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Ketchup", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 500, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Khaki Papers", category: "Administration", subcategory: "Stationery", unit_price_kes: 290, reorder_level_qty: 10, reorder_level_unit: "pkts" },
      { item_name: "Kienyeji Eggs", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 20, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Kitchen Cleaner", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 240, reorder_level_qty: 5, reorder_level_unit: "pcs" },
      { item_name: "Kitchen Roll", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 0, reorder_level_qty: 1, reorder_level_unit: "bale" },
      { item_name: "Kuku Kienyeji", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 800, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Leeks", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 30, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Lemon Squeezer", category: "Maintenance", subcategory: "Maintenance Supplies", unit_price_kes: 500, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Lemons", category: "Food & Beverage", subcategory: "Bar Stock-Alcoholic", unit_price_kes: 10, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Lime", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 10, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Long Rice", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 180, reorder_level_qty: 40, reorder_level_unit: "pkts" },
      { item_name: "Mabuyu", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 50, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Maize Flour", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 107, reorder_level_qty: 60, reorder_level_unit: "pkts" },
      { item_name: "Mala", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: 40, reorder_level_unit: "pcs" },
      { item_name: "Mangoes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 15, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Masala Spices", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Matches", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 10, reorder_level_qty: 500, reorder_level_unit: "pcs" },
      { item_name: "Mayonnaise", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 450, reorder_level_qty: 12, reorder_level_unit: "pcs" },
      { item_name: "Milk", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 60, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Millet Flour", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 180, reorder_level_qty: 20, reorder_level_unit: "pkts" },
      { item_name: "Milkmaid", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 120, reorder_level_qty: 60, reorder_level_unit: "pcs" },
      { item_name: "Mineral Water", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 21, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Moringa", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Mothballs", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 50, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Napkins", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 50, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Ndizi", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 10, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Newspapers", category: "Administration", subcategory: "Stationery", unit_price_kes: 20, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Noodles", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 30, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Nutmeg", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Onions", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 25, reorder_level_qty: 200, reorder_level_unit: "pcs" },
      { item_name: "Oranges", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 10, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Pampers", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 1500, reorder_level_qty: 5, reorder_level_unit: "pkts" },
      { item_name: "Paprika", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Pawpaw", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 20, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Peanuts", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 50, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Peas", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Pineapples", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 80, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Plates Paper", category: "Food & Beverage", subcategory: "Kitchen Supplies", unit_price_kes: 30, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Potatoes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 40, reorder_level_qty: 200, reorder_level_unit: "pcs" },
      { item_name: "Prawns", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 600, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Rice", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 180, reorder_level_qty: 50, reorder_level_unit: "pkts" },
      { item_name: "Royco", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 50, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Salt", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 50, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Sauce", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: 50, reorder_level_unit: "pcs" },
      { item_name: "Shampoo", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 200, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Soap Powder", category: "Housekeeping", subcategory: "Cleaning Supplies", unit_price_kes: 150, reorder_level_qty: 10, reorder_level_unit: "pkgs" },
      { item_name: "Soda", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 31, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Soda 300ML", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 31, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Soda Take Away 500ML", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 60, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Sugar", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 120, reorder_level_qty: 50, reorder_level_unit: "pkts" },
      { item_name: "Sweet Potatoes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 30, reorder_level_qty: 100, reorder_level_unit: "pcs" },
      { item_name: "Tamarind", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Tea Leaves", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 200, reorder_level_qty: 20, reorder_level_unit: "pkts" },
      { item_name: "Tomatoes", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 30, reorder_level_qty: 200, reorder_level_unit: "pcs" },
      { item_name: "Tomato Paste", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 20, reorder_level_unit: "pcs" },
      { item_name: "Toothpaste", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 150, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Turmeric", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 150, reorder_level_qty: 18, reorder_level_unit: "pcs" },
      { item_name: "Ugali", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 100, reorder_level_qty: 50, reorder_level_unit: "pkts" },
      { item_name: "Vanilla", category: "Food & Beverage", subcategory: "Restaurant Items", unit_price_kes: 200, reorder_level_qty: 12, reorder_level_unit: "pcs" },
      { item_name: "Vaseline", category: "Housekeeping", subcategory: "Guest Amenities", unit_price_kes: 100, reorder_level_qty: 24, reorder_level_unit: "pcs" },
      { item_name: "Water 10LTR", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 86, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Water 1LTR", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 41, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Water 500ML", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 21, reorder_level_qty: null, reorder_level_unit: null },
      { item_name: "Yoghurt", category: "Food & Beverage", subcategory: "Bar Stock-Non-alcoholic", unit_price_kes: 50, reorder_level_qty: 50, reorder_level_unit: "pcs" },
    ];

    console.log(`Restoring ${inventoryData.length} items to simple_items...\n`);
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const item of inventoryData) {
      try {
        await client.query(`
          INSERT INTO simple_items (
            sku, item_name, description, retail_price, cost_price, 
            category, unit_of_measure, quantity, reorder_level, 
            is_active, branch_id, last_updated
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 0, $8, true, $9, NOW()
          )
        `, [
          `SIM-${item.item_name.substring(0, 10).toUpperCase().replace(/\s/g, '')}`,
          item.item_name,
          `${item.category} - ${item.subcategory}`,
          item.unit_price_kes,
          item.unit_price_kes * 0.8, // Assuming 20% margin
          item.subcategory,
          item.reorder_level_unit || 'pcs',
          item.reorder_level_qty || 0,
          branchId
        ]);
        insertedCount++;
      } catch (e) {
        console.log(`  ⚠️ Skipped ${item.item_name}: ${e.message.substring(0, 100)}`);
        skippedCount++;
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Inserted: ${insertedCount} records`);
    console.log(`  ⚠️ Skipped: ${skippedCount} records`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SIMPLE ITEMS RESTORATION COMPLETE!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await client.query('ROLLBACK');
    console.log('✅ Rollback successful');
    process.exit(1);
  } finally {
    await client.end();
  }
}

restoreSimpleItems();
