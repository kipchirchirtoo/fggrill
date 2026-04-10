const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Kyogong Branch ID
const KYOGONG_BRANCH_ID = 1;

const menuData = {
  "STARTERS & SALADS": {
    "STARTERS": [
      { name: "Mushroom Soup", price: 250 },
      { name: "Butternut Soup", price: 250 },
      { name: "Bone Soup (Tumbukiza)", price: 200 },
      { name: "Beef Stock", price: 350 },
      { name: "Tomato Soup", price: 50 },
      { name: "Vegetable Soup", price: 200 }
    ],
    "SALADS": [
      { name: "Cheese Onions", price: 100 },
      { name: "Coleslaw Salad", price: 150 },
      { name: "Quacamole", price: 50 },
      { name: "Kachumbari", price: 150 },
      { name: "Chef's Salad", price: 150 },
      { name: "Famous Salad", price: 100 }
    ]
  },
  "BEEF": {
    "BEEF BOILED": [
      { name: "Beef Boiled 1/4kg", price: 300 },
      { name: "Beef Boiled 1/2kg", price: 400 },
      { name: "Beef Boiled 3/4kg", price: 700 },
      { name: "Beef Boiled 1kg", price: 1000 }
    ],
    "BEEF WET FRY": [
      { name: "Beef Wet Fry 1/4kg", price: 400 },
      { name: "Beef Wet Fry 1/2kg", price: 700 },
      { name: "Beef Wet Fry 3/4kg", price: 1000 },
      { name: "Beef Wet Fry 1kg", price: 1400 }
    ],
    "BEEF STEW": [
      { name: "Beef Stew 1/4kg", price: 400 },
      { name: "Beef Stew 1/2kg", price: 700 },
      { name: "Beef Stew 3/4kg", price: 1000 },
      { name: "Beef Stew 1kg", price: 1400 }
    ],
    "BEEF DRY FRY": [
      { name: "Beef Dry Fry 1/4kg", price: 400 },
      { name: "Beef Dry Fry 1/2kg", price: 800 },
      { name: "Beef Dry Fry 3/4kg", price: 1200 },
      { name: "Beef Dry Fry 1kg", price: 1400 }
    ],
    "BEEF TUMBUKIZA": [
      { name: "Beef Tumbukiza 1/4kg", price: 400 },
      { name: "Beef Tumbukiza 1/2kg", price: 700 },
      { name: "Beef Tumbukiza 3/4kg", price: 1300 },
      { name: "Beef Tumbukiza 1kg", price: 1800 }
    ],
    "PAN FRIED BEEF": [
      { name: "Pan Fried Beef 1/4kg", price: 400 },
      { name: "Pan Fried Beef 1/2kg", price: 900 },
      { name: "Pan Fried Beef 3/4kg", price: 1100 },
      { name: "Pan Fried Beef 1kg", price: 1500 }
    ],
    "OTHER BEEF": [
      { name: "Beef Curry", price: 400 },
      { name: "Minced Meat", price: 400 },
      { name: "Liver", price: 400 },
      { name: "Beef Biryani", price: 500 },
      { name: "Sizzling Beef (4pcs)", price: 400 },
      { name: "Beef Skewers 1/2kg", price: 400 }
    ]
  },
  "CHICKEN": {
    "BROILER": [
      { name: "Broiler Chicken 1/4", price: 350 },
      { name: "Broiler Chicken 1/2", price: 700 },
      { name: "Broiler Chicken Full", price: 1400 }
    ],
    "KIENYEJI": [
      { name: "Kienyeji Chicken 1/4", price: 550 },
      { name: "Kienyeji Chicken 1/2", price: 1000 },
      { name: "Kienyeji Chicken Full", price: 2000 },
      { name: "Kienyeji Chicken Tumbukiza 1/4", price: 550 },
      { name: "Kienyeji Chicken Boiled 1/2", price: 1100 },
      { name: "Kienyeji Chicken Boiled Full", price: 2000 }
    ]
  },
  "FISH & STEAK": {
    "FISH": [
      { name: "Whole Fish", price: 550 },
      { name: "Whole Fish Curry", price: 650 },
      { name: "Pan Fried Fish Fillet", price: 500 },
      { name: "Fish Fillet Curry", price: 500 },
      { name: "Fish Fingers", price: 550 }
    ],
    "STEAKS": [
      { name: "Pork Chops", price: 650 },
      { name: "Honey Glazed Pork Chops", price: 700 },
      { name: "Sirloin Steak", price: 850 },
      { name: "T Bone Steak", price: 1100 },
      { name: "Pepper Steak", price: 500 }
    ]
  },
  "MBUZI & CHOMA": {
    "MBUZI BOILED": [
      { name: "Mbuzi Boiled 1/4kg", price: 400 },
      { name: "Mbuzi Boiled 1/2kg", price: 800 },
      { name: "Mbuzi Boiled 3/4kg", price: 1200 },
      { name: "Mbuzi Boiled 1kg", price: 1400 }
    ],
    "MBUZI WET FRY": [
      { name: "Mbuzi Wet Fry 1/4kg", price: 400 },
      { name: "Mbuzi Wet Fry 1/2kg", price: 600 },
      { name: "Mbuzi Wet Fry 3/4kg", price: 800 },
      { name: "Mbuzi Wet Fry 1kg", price: 1400 }
    ],
    "MBUZI STEW": [
      { name: "Mbuzi Stew 1/4kg", price: 400 },
      { name: "Mbuzi Stew 1/2kg", price: 800 },
      { name: "Mbuzi Stew 3/4kg", price: 1200 },
      { name: "Mbuzi Stew 1kg", price: 1400 }
    ],
    "MBUZI DRY FRY": [
      { name: "Mbuzi Dry Fry 1/4kg", price: 400 },
      { name: "Mbuzi Dry Fry 1/2kg", price: 800 },
      { name: "Mbuzi Dry Fry 3/4kg", price: 1200 },
      { name: "Mbuzi Dry Fry 1kg", price: 1400 }
    ],
    "MBUZI TUMBUKIZA": [
      { name: "Mbuzi Tumbukiza 1/4kg", price: 400 },
      { name: "Mbuzi Tumbukiza 1/2kg", price: 800 },
      { name: "Mbuzi Tumbukiza 3/4kg", price: 1200 },
      { name: "Mbuzi Tumbukiza 1kg", price: 1400 }
    ],
    "PAN FRIED MBUZI": [
      { name: "Pan Fried Mbuzi 1/4kg", price: 400 },
      { name: "Pan Fried Mbuzi 1/2kg", price: 800 },
      { name: "Pan Fried Mbuzi 3/4kg", price: 1200 },
      { name: "Pan Fried Mbuzi 1kg", price: 1400 }
    ],
    "OTHER MBUZI": [
      { name: "Matumbo", price: 400 }
    ],
    "CHOMAZONE": [
      { name: "Mbuzi Choma 1/4kg", price: 400 },
      { name: "Mbuzi Choma 1/2kg", price: 800 },
      { name: "Mbuzi Choma 3/4kg", price: 1200 },
      { name: "Mbuzi Choma 1kg", price: 1400 },
      { name: "Kuku Choma Broiler 1/4", price: 400 },
      { name: "Kuku Choma Broiler Full", price: 2000 },
      { name: "Kuku Choma Kienyeji 1/4", price: 550 },
      { name: "Kuku Choma Kienyeji 1/2", price: 1100 },
      { name: "Kuku Choma Kienyeji Full", price: 2000 },
      { name: "Liver 1/4", price: 400 },
      { name: "Liver 1/2", price: 800 },
      { name: "Liver 3/4", price: 1200 }
    ]
  },
  "ACCOMPANIMENTS & VEGETABLES": {
    "ACCOMPANIMENTS": [
      { name: "White Ugali", price: 70 },
      { name: "Brown Ugali", price: 100 },
      { name: "French Fries", price: 200 },
      { name: "Masala Chips", price: 250 },
      { name: "Garlic Chips", price: 250 },
      { name: "Chips Take Away", price: 230 },
      { name: "Roast Potatoes", price: 200 },
      { name: "Potato Wedges", price: 200 },
      { name: "Saute Potatoes", price: 250 },
      { name: "Mashed Potatoes", price: 250 },
      { name: "Matoke", price: 250 },
      { name: "Plain Rice", price: 150 },
      { name: "Indian Rice", price: 350 },
      { name: "Pilau", price: 200 },
      { name: "Githeri", price: 200 },
      { name: "White Chapati (2pcs)", price: 100 },
      { name: "Brown Chapati (2pcs)", price: 140 }
    ],
    "VEGETABLES": [
      { name: "Bean Stew", price: 100 },
      { name: "Peas (Minji)", price: 250 },
      { name: "Lentils", price: 250 },
      { name: "Ndengu Plain", price: 250 },
      { name: "Steamed Mixed Veges", price: 300 },
      { name: "Spinach Plain", price: 100 },
      { name: "Mixed Spinach", price: 200 },
      { name: "Cabbage", price: 50 },
      { name: "Mixed Cabbage", price: 200 },
      { name: "Sukuma", price: 50 },
      { name: "Mixed Sukuma", price: 200 },
      { name: "Managu Plain", price: 150 },
      { name: "Mixed Managu", price: 200 }
    ]
  },
  "SNACKS & EGGS": {
    "SNACKS / BAKED GOODS": [
      { name: "Nduma", price: 100 },
      { name: "Sweet Potatoes", price: 100 },
      { name: "White Chapati", price: 50 },
      { name: "Chapati Roll", price: 200 },
      { name: "Brown Chapati", price: 70 },
      { name: "Mandazi (3pcs)", price: 50 },
      { name: "Marble Cake", price: 100 },
      { name: "Scones (2pcs)", price: 50 },
      { name: "Queen Cakes (2pcs)", price: 80 },
      { name: "Swiss Roll", price: 100 },
      { name: "Croissant (2pcs)", price: 50 },
      { name: "Tea Scone (2pcs)", price: 100 },
      { name: "Mahamri", price: 50 },
      { name: "Pancakes (2pcs)", price: 100 },
      { name: "Doughnut (2pcs)", price: 50 },
      { name: "Cookies (3pcs)", price: 100 },
      { name: "Sweet Corn", price: 100 },
      { name: "French Toast", price: 100 },
      { name: "Toast Bread", price: 50 },
      { name: "Naan Bread", price: 100 }
    ],
    "EGGS": [
      { name: "Boiled Eggs", price: 100 },
      { name: "Poached Eggs", price: 100 },
      { name: "Fried Eggs", price: 100 },
      { name: "Plain Omelet (Broiler)", price: 150 },
      { name: "Plain Omelet (Kienyeji)", price: 200 },
      { name: "Spanish Omelet (Kienyeji)", price: 150 },
      { name: "Spanish Omelet (Broiler)", price: 200 },
      { name: "Scrambled Eggs (Broiler)", price: 150 },
      { name: "Scrambled Eggs (Kienyeji)", price: 200 },
      { name: "Kebab", price: 100 },
      { name: "Bacon", price: 350 },
      { name: "Sausages", price: 120 },
      { name: "Sausage Roll", price: 150 },
      { name: "Weetabix", price: 100 },
      { name: "Beef Samosa", price: 100 },
      { name: "Vegetable Samosa", price: 120 },
      { name: "Waffles", price: 100 }
    ]
  },
  "DESSERTS": {
    "DESSERTS": [
      { name: "Bananas (2pcs)", price: 50 },
      { name: "Fruit Salad", price: 150 },
      { name: "Fruit Platter", price: 200 },
      { name: "Ice Cream (Scoop)", price: 250 },
      { name: "Coup Famous (with ice cream)", price: 200 },
      { name: "Black Forest", price: 100 },
      { name: "Plain Honey", price: 80 }
    ]
  },
  "SPECIALS": {
    "SPECIALS": [
      { name: "Bacon Special", price: 450 },
      { name: "Chips Special", price: 250 },
      { name: "Pilau Special", price: 250 },
      { name: "Rice Special", price: 250 },
      { name: "Kebab Special", price: 200 },
      { name: "Sausage Special", price: 200 },
      { name: "Samosa Special", price: 200 },
      { name: "Special Managu", price: 250 },
      { name: "Food Platter", price: 2500 },
      { name: "Full Breakfast", price: 1000 }
    ]
  },
  "INDIAN FOOD": {
    "INDIAN FOOD": [
      { name: "Bhajia", price: 250 },
      { name: "Maroo Bhajia", price: 250 },
      { name: "Vegetable Biryani", price: 200 },
      { name: "Vegetable Curry", price: 200 },
      { name: "Egg Curry", price: 300 }
    ]
  },
  "PASTA": {
    "PASTA": [
      { name: "Macaroni Plain", price: 200 },
      { name: "Spaghetti Plain", price: 200 },
      { name: "Spaghetti Boulogne", price: 400 },
      { name: "Spaghetti Napolitano", price: 300 }
    ]
  },
  "PIZZA": {
    "PIZZA": [
      { name: "Macaroni Pizza", price: 1000 },
      { name: "Veggie Pizza", price: 1000 },
      { name: "Margherita Pizza", price: 1000 },
      { name: "Pepperoni Pizza", price: 1000 },
      { name: "Barbeque Pizza", price: 1200 },
      { name: "Hawaiian Pizza", price: 1200 },
      { name: "Peri Peri Chicken Pizza", price: 1200 },
      { name: "Famous Super Meaty Pizza", price: 1500 }
    ]
  },
  "COLD BEVERAGES": {
    "COLD BEVERAGES": [
      { name: "Mango Juice", price: 200 },
      { name: "Pineapple Juice", price: 200 },
      { name: "Cocktail Juice", price: 200 },
      { name: "Passion Juice", price: 200 },
      { name: "Beet Root Juice", price: 300 },
      { name: "Mango Smoothie", price: 300 },
      { name: "Banana Smoothie", price: 300 },
      { name: "Fresh Milk", price: 100 },
      { name: "Mala (Mursik)", price: 100 },
      { name: "Strawberry Milkshake", price: 300 },
      { name: "Vanilla Milkshake", price: 300 },
      { name: "Soda (300ml)", price: 100 },
      { name: "Soda 500ml (Takeaway)", price: 150 },
      { name: "Mineral Water (500ml)", price: 50 },
      { name: "Mineral Water (1 Litre)", price: 100 },
      { name: "Mineral Water (10 Litres)", price: 500 },
      { name: "Delmonte", price: 450 }
    ]
  },
  "HOT BEVERAGES": {
    "TEA": [
      { name: "Tea Mug", price: 50 },
      { name: "Tea Mug (Takeaway)", price: 100 },
      { name: "Tea Pot (500ml)", price: 200 },
      { name: "Tea Flask (1 Litre)", price: 300 },
      { name: "Tea Flask (2 Litres)", price: 400 },
      { name: "Tea Flask (3 Litres)", price: 600 },
      { name: "English Tea (Pot)", price: 200 },
      { name: "Ginger Tea (Pot)", price: 200 },
      { name: "Ginger Tea (Mug)", price: 100 },
      { name: "Tea Masala (500ml)", price: 200 },
      { name: "Tea Masala (1 Litre)", price: 450 },
      { name: "Tea Masala (2 Litres)", price: 600 },
      { name: "Special Tea (500ml)", price: 250 },
      { name: "Special Tea (1 Litre)", price: 500 },
      { name: "Special Tea (2 Litres)", price: 800 },
      { name: "Black Tea", price: 50 },
      { name: "Green Tea", price: 100 },
      { name: "Hot Lemon", price: 100 },
      { name: "Lemon Tea with Honey", price: 150 },
      { name: "Lemon Tea (500ml)", price: 200 },
      { name: "Lemon Tea (1 Litre)", price: 350 },
      { name: "Lemon Tea (2 Litres)", price: 450 },
      { name: "Hot Lemon with Honey", price: 150 }
    ],
    "MILO": [
      { name: "Milo", price: 100 },
      { name: "Milo (Takeaway)", price: 200 },
      { name: "Milo (Tea Pot)", price: 200 }
    ],
    "CHOCOLATE": [
      { name: "Hot Chocolate", price: 100 },
      { name: "Hot Chocolate (Takeaway)", price: 200 },
      { name: "Hot Chocolate (Tea Pot)", price: 300 }
    ],
    "COFFEE": [
      { name: "White/Black Coffee Mug", price: 100 },
      { name: "White Coffee (Takeaway)", price: 200 },
      { name: "White/Black Coffee (500ml)", price: 200 },
      { name: "White Coffee (1 Litre)", price: 350 },
      { name: "White Coffee (2 Litres)", price: 500 },
      { name: "Lemon Coffee with Honey", price: 150 },
      { name: "Dawa / Concoction", price: 200 },
      { name: "Porridge / Uji", price: 100 }
    ]
  }
};

async function populateMenu() {
  console.log('🍽️  Starting Kyogong Restaurant Menu Population...\n');

  let totalCategories = 0;
  let totalSubcategories = 0;
  let totalItems = 0;

  try {
    for (const [mainCategory, subcategories] of Object.entries(menuData)) {
      console.log(`\n📂 Processing Main Category: ${mainCategory}`);
      
      for (const [subcategoryName, items] of Object.entries(subcategories)) {
        console.log(`  📁 Subcategory: ${subcategoryName}`);
        
        // Create or get category
        const { data: existingCategory } = await supabase
          .from('restaurant_menu_categories')
          .select('id')
          .eq('name', subcategoryName)
          .eq('branch_id', KYOGONG_BRANCH_ID)
          .maybeSingle();

        let categoryId;
        
        if (existingCategory) {
          categoryId = existingCategory.id;
          console.log(`    ✓ Category exists (ID: ${categoryId})`);
        } else {
          const { data: newCategory, error: categoryError } = await supabase
            .from('restaurant_menu_categories')
            .insert({
              name: subcategoryName,
              branch_id: KYOGONG_BRANCH_ID,
              description: `${mainCategory} - ${subcategoryName}`,
              is_active: true
            })
            .select()
            .single();

          if (categoryError) {
            console.error(`    ❌ Error creating category: ${categoryError.message}`);
            continue;
          }

          categoryId = newCategory.id;
          totalCategories++;
          console.log(`    ✓ Created category (ID: ${categoryId})`);
        }

        totalSubcategories++;

        // Insert menu items
        for (const item of items) {
          // Check if item already exists
          const { data: existingItem } = await supabase
            .from('restaurant_menu_items')
            .select('id')
            .eq('name', item.name)
            .eq('category_id', categoryId)
            .maybeSingle();

          if (existingItem) {
            // Update price if different
            await supabase
              .from('restaurant_menu_items')
              .update({ price: item.price })
              .eq('id', existingItem.id);
            console.log(`    ↻ Updated: ${item.name} - KES ${item.price}`);
          } else {
            const { error: itemError } = await supabase
              .from('restaurant_menu_items')
              .insert({
                name: item.name,
                category_id: categoryId,
                price: item.price,
                branch_id: KYOGONG_BRANCH_ID,
                is_available: true,
                description: item.name
              });

            if (itemError) {
              console.error(`    ❌ Error creating item ${item.name}: ${itemError.message}`);
            } else {
              totalItems++;
              console.log(`    ✓ Added: ${item.name} - KES ${item.price}`);
            }
          }
        }
      }
    }

    console.log('\n\n✅ MENU POPULATION COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   • New Categories Created: ${totalCategories}`);
    console.log(`   • Total Subcategories: ${totalSubcategories}`);
    console.log(`   • New Menu Items Added: ${totalItems}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run the script
populateMenu()
  .then(() => {
    console.log('✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
