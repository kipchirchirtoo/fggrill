const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  try {
    const { data: recipes, error: recipesErr } = await supabase
      .from('restaurant_recipes')
      .select('*')
      .limit(1);
    
    if (recipesErr) console.error("Error fetching restaurant_recipes:", recipesErr);
    else console.log("Restaurant Recipes Table Sample:", recipes);

    const { data: recipe_ingredients, error: riErr } = await supabase
      .from('restaurant_recipe_ingredients')
      .select('*')
      .limit(1);

    if (riErr) console.error("Error fetching restaurant_recipe_ingredients:", riErr);
    else console.log("Restaurant Recipe Ingredients Table Sample:", recipe_ingredients);
    
    const { data: inventory_items, error: invErr } = await supabase
      .from('inventory_items')
      .select('id, name, unit, cost_per_unit, branch_id')
      .limit(3);

    if (invErr) console.error("Error fetching inventory items:", invErr);
    else console.log("Inventory Items Table Sample:", inventory_items);
    
  } catch (err) {
    console.error(err);
  }
}

checkSchema();
