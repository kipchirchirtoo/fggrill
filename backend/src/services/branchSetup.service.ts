import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Clones all configuration and setup data from Bomet Town (Branch 2) to a new branch.
 * 
 * @param targetBranchId The ID of the newly created branch
 * @param targetBranchName The name of the newly created branch
 */
export const cloneBranchSetup = async (targetBranchId: number, targetBranchName: string): Promise<void> => {
  logger.info(`Starting configuration clone for branch ${targetBranchName} (ID: ${targetBranchId}) using Bomet Town as reference...`);

  try {
    // 1. Identify the source branch ID dynamically (look for Bomet Town, fallback to 2)
    let sourceBranchId = 2;
    const { data: bometBranch, error: bometErr } = await supabase
      .from('branches')
      .select('id')
      .ilike('name', '%bomet town%')
      .limit(1);

    if (!bometErr && bometBranch && bometBranch.length > 0) {
      sourceBranchId = bometBranch[0].id;
    }
    logger.info(`Using source branch ID ${sourceBranchId} as template.`);

    if (sourceBranchId === targetBranchId) {
      logger.warn(`Source and target branch IDs are the same (${sourceBranchId}). Skipping clone.`);
      return;
    }

    const cleanBranchName = targetBranchName.toUpperCase().trim();

    // 2. Clone inventory_locations
    logger.info(`Cloning inventory_locations...`);
    const { data: sourceLocs, error: locsErr } = await supabase
      .from('inventory_locations')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (locsErr) throw new Error(`Failed to fetch source locations: ${locsErr.message}`);

    const locationIdMap = new Map<string, string>();
    if (sourceLocs && sourceLocs.length > 0) {
      const locsToInsert = sourceLocs.map(loc => {
        // Replace "BOMET TOWN" or "Bomet Town" with the new branch name
        let newName = loc.name || '';
        if (newName.toUpperCase().includes('BOMET TOWN')) {
          newName = newName.replace(/BOMET TOWN/gi, cleanBranchName);
        } else if (newName.toUpperCase().includes('BOMET')) {
          newName = newName.replace(/BOMET/gi, cleanBranchName);
        } else {
          newName = `${cleanBranchName} ${newName}`;
        }

        const { id, created_at, updated_at, branch_id, ...rest } = loc;

        return {
          ...rest,
          name: newName,
          branch_id: targetBranchId
        };
      });

      const { data: newLocs, error: insLocsErr } = await supabase
        .from('inventory_locations')
        .insert(locsToInsert)
        .select();

      if (insLocsErr) throw new Error(`Failed to insert cloned locations: ${insLocsErr.message}`);

      // Map old location IDs to new location IDs
      sourceLocs.forEach((oldLoc, index) => {
        if (newLocs && newLocs[index]) {
          locationIdMap.set(oldLoc.id, newLocs[index].id);
        }
      });
      logger.info(`Successfully cloned ${newLocs?.length} inventory_locations.`);
    }

    // 3. Clone pos_outlets
    logger.info(`Cloning pos_outlets...`);
    const { data: sourceOutlets, error: outletsErr } = await supabase
      .from('pos_outlets')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (outletsErr) throw new Error(`Failed to fetch source outlets: ${outletsErr.message}`);

    const outletIdMap = new Map<string, string>();
    if (sourceOutlets && sourceOutlets.length > 0) {
      const outletsToInsert = sourceOutlets.map(out => {
        let newName = out.name || '';
        if (newName.toUpperCase().includes('BOMET TOWN')) {
          newName = newName.replace(/BOMET TOWN/gi, cleanBranchName);
        } else if (newName.toUpperCase().includes('BOMET')) {
          newName = newName.replace(/BOMET/gi, cleanBranchName);
        } else {
          newName = `${cleanBranchName} ${newName}`;
        }

        const mappedLocationId = out.inventory_location_id ? locationIdMap.get(out.inventory_location_id) : null;
        const { id, created_at, updated_at, branch_id, inventory_location_id, ...rest } = out;

        return {
          ...rest,
          name: newName,
          inventory_location_id: mappedLocationId || null,
          branch_id: targetBranchId
        };
      });

      const { data: newOutlets, error: insOutletsErr } = await supabase
        .from('pos_outlets')
        .insert(outletsToInsert)
        .select();

      if (insOutletsErr) throw new Error(`Failed to insert cloned outlets: ${insOutletsErr.message}`);

      sourceOutlets.forEach((oldOut, index) => {
        if (newOutlets && newOutlets[index]) {
          outletIdMap.set(oldOut.id, newOutlets[index].id);
        }
      });
      logger.info(`Successfully cloned ${newOutlets?.length} pos_outlets.`);
    }

    // 4. Clone restaurant_menu_categories
    logger.info(`Cloning restaurant_menu_categories...`);
    const { data: sourceMenuCats, error: menuCatsErr } = await supabase
      .from('restaurant_menu_categories')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (menuCatsErr) throw new Error(`Failed to fetch source menu categories: ${menuCatsErr.message}`);

    const menuCategoryIdMap = new Map<string, string>();
    if (sourceMenuCats && sourceMenuCats.length > 0) {
      const menuCatsToInsert = sourceMenuCats.map(cat => {
        const { id, created_at, updated_at, branch_id, ...rest } = cat;
        return {
          ...rest,
          branch_id: targetBranchId
        };
      });

      const { data: newMenuCats, error: insMenuCatsErr } = await supabase
        .from('restaurant_menu_categories')
        .insert(menuCatsToInsert)
        .select();

      if (insMenuCatsErr) throw new Error(`Failed to insert cloned menu categories: ${insMenuCatsErr.message}`);

      sourceMenuCats.forEach((oldCat, index) => {
        if (newMenuCats && newMenuCats[index]) {
          menuCategoryIdMap.set(oldCat.id, newMenuCats[index].id);
        }
      });
      logger.info(`Successfully cloned ${newMenuCats?.length} restaurant_menu_categories.`);
    }

    // 5. Clone restaurant_menu_items
    logger.info(`Cloning restaurant_menu_items...`);
    const { data: sourceMenuItems, error: menuItemsErr } = await supabase
      .from('restaurant_menu_items')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (menuItemsErr) throw new Error(`Failed to fetch source menu items: ${menuItemsErr.message}`);

    const menuItemIdMap = new Map<string, string>();
    if (sourceMenuItems && sourceMenuItems.length > 0) {
      const menuItemsToInsert = sourceMenuItems.map(item => {
        const mappedCatId = item.category_id ? menuCategoryIdMap.get(item.category_id) : null;
        const { id, created_at, updated_at, branch_id, category_id, ...rest } = item;
        return {
          ...rest,
          category_id: mappedCatId || null,
          branch_id: targetBranchId
        };
      });

      const { data: newMenuItems, error: insMenuItemsErr } = await supabase
        .from('restaurant_menu_items')
        .insert(menuItemsToInsert)
        .select();

      if (insMenuItemsErr) throw new Error(`Failed to insert cloned menu items: ${insMenuItemsErr.message}`);

      sourceMenuItems.forEach((oldItem, index) => {
        if (newMenuItems && newMenuItems[index]) {
          menuItemIdMap.set(oldItem.id, newMenuItems[index].id);
        }
      });
      logger.info(`Successfully cloned ${newMenuItems?.length} restaurant_menu_items.`);
    }

    // 6. Clone bar_drink_categories
    logger.info(`Cloning bar_drink_categories...`);
    const { data: sourceBarCats, error: barCatsErr } = await supabase
      .from('bar_drink_categories')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (barCatsErr) throw new Error(`Failed to fetch source bar categories: ${barCatsErr.message}`);

    const barCategoryIdMap = new Map<string, string>();
    if (sourceBarCats && sourceBarCats.length > 0) {
      const barCatsToInsert = sourceBarCats.map(cat => {
        const { id, created_at, updated_at, branch_id, ...rest } = cat;
        return {
          ...rest,
          branch_id: targetBranchId
        };
      });

      const { data: newBarCats, error: insBarCatsErr } = await supabase
        .from('bar_drink_categories')
        .insert(barCatsToInsert)
        .select();

      if (insBarCatsErr) throw new Error(`Failed to insert cloned bar categories: ${insBarCatsErr.message}`);

      sourceBarCats.forEach((oldCat, index) => {
        if (newBarCats && newBarCats[index]) {
          barCategoryIdMap.set(oldCat.id, newBarCats[index].id);
        }
      });
      logger.info(`Successfully cloned ${newBarCats?.length} bar_drink_categories.`);
    }

    // 7. Clone bar_drinks
    logger.info(`Cloning bar_drinks...`);
    const { data: sourceBarDrinks, error: barDrinksErr } = await supabase
      .from('bar_drinks')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (barDrinksErr) throw new Error(`Failed to fetch source bar drinks: ${barDrinksErr.message}`);

    const barDrinkIdMap = new Map<string, string>();
    if (sourceBarDrinks && sourceBarDrinks.length > 0) {
      const barDrinksToInsert = sourceBarDrinks.map(drink => {
        const mappedCatId = drink.category_id ? barCategoryIdMap.get(drink.category_id) : null;
        const { id, created_at, updated_at, branch_id, category_id, ...rest } = drink;
        return {
          ...rest,
          category_id: mappedCatId || null,
          branch_id: targetBranchId
        };
      });

      const { data: newBarDrinks, error: insBarDrinksErr } = await supabase
        .from('bar_drinks')
        .insert(barDrinksToInsert)
        .select();

      if (insBarDrinksErr) throw new Error(`Failed to insert cloned bar drinks: ${insBarDrinksErr.message}`);

      sourceBarDrinks.forEach((oldDrink, index) => {
        if (newBarDrinks && newBarDrinks[index]) {
          barDrinkIdMap.set(oldDrink.id, newBarDrinks[index].id);
        }
      });
      logger.info(`Successfully cloned ${newBarDrinks?.length} bar_drinks.`);
    }

    // 8. Clone pos_outlet_items
    logger.info(`Cloning pos_outlet_items...`);
    const { data: sourceOutletItems, error: outletItemsErr } = await supabase
      .from('pos_outlet_items')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (outletItemsErr) throw new Error(`Failed to fetch source outlet items: ${outletItemsErr.message}`);

    if (sourceOutletItems && sourceOutletItems.length > 0) {
      const outletItemsToInsert = sourceOutletItems.map(item => {
        const mappedOutletId = item.outlet_id ? outletIdMap.get(item.outlet_id) : null;
        let mappedMenuItemId = null;
        let mappedSourceItemId = null;

        if (item.source_table === 'restaurant_menu_items') {
          mappedSourceItemId = item.source_item_id ? menuItemIdMap.get(item.source_item_id) : null;
          mappedMenuItemId = item.menu_item_id ? menuItemIdMap.get(item.menu_item_id) : null;
        } else if (item.source_table === 'bar_drinks') {
          mappedSourceItemId = item.source_item_id ? barDrinkIdMap.get(item.source_item_id) : null;
          mappedMenuItemId = item.menu_item_id ? barDrinkIdMap.get(item.menu_item_id) : null;
        }

        const { id, created_at, updated_at, branch_id, outlet_id, menu_item_id, source_item_id, ...rest } = item;

        return {
          ...rest,
          outlet_id: mappedOutletId || item.outlet_id,
          menu_item_id: mappedMenuItemId || item.menu_item_id || null,
          source_item_id: mappedSourceItemId || item.source_item_id || null,
          branch_id: targetBranchId
        };
      }).filter(item => item.outlet_id); // Filter out items with no mapped outlet

      const { data: newOutletItems, error: insOutletItemsErr } = await supabase
        .from('pos_outlet_items')
        .insert(outletItemsToInsert)
        .select();

      if (insOutletItemsErr) throw new Error(`Failed to insert cloned outlet items: ${insOutletItemsErr.message}`);
      logger.info(`Successfully cloned ${newOutletItems?.length} pos_outlet_items.`);
    }

    // 9. Clone recipes and recipe_items
    logger.info(`Cloning recipes and recipe_items...`);
    const { data: sourceRecipes, error: recipesErr } = await supabase
      .from('recipes')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (recipesErr) throw new Error(`Failed to fetch source recipes: ${recipesErr.message}`);

    if (sourceRecipes && sourceRecipes.length > 0) {
      let recipeCount = 0;
      for (const recipe of sourceRecipes) {
        const mappedMenuItemId = recipe.menu_item_id ? menuItemIdMap.get(recipe.menu_item_id) : null;
        const { id, created_at, updated_at, branch_id, menu_item_id, ...rest } = recipe;

        const newRecipeData = {
          ...rest,
          menu_item_id: mappedMenuItemId || null,
          branch_id: targetBranchId
        };

        const { data: newRecipe, error: insRecipeErr } = await supabase
          .from('recipes')
          .insert([newRecipeData])
          .select()
          .single();

        if (!insRecipeErr && newRecipe) {
          recipeCount++;
          // Fetch and clone recipe_items for this recipe
          const { data: sourceRecipeItems, error: rItemsErr } = await supabase
            .from('recipe_items')
            .select('*')
            .eq('recipe_id', recipe.id);

          if (!rItemsErr && sourceRecipeItems && sourceRecipeItems.length > 0) {
            const rItemsToInsert = sourceRecipeItems.map(item => {
              const { id, recipe_id, ...restItem } = item;
              return {
                ...restItem,
                recipe_id: newRecipe.id
              };
            });

            await supabase.from('recipe_items').insert(rItemsToInsert);
          }
        }
      }
      logger.info(`Successfully cloned ${recipeCount} recipes and their recipe_items.`);
    }

    // 10. Clone restaurant_recipes and restaurant_recipe_ingredients
    logger.info(`Cloning restaurant_recipes and restaurant_recipe_ingredients...`);
    const { data: sourceRestRecipes, error: restRecipesErr } = await supabase
      .from('restaurant_recipes')
      .select('*');

    if (!restRecipesErr && sourceRestRecipes && sourceRestRecipes.length > 0) {
      // Filter recipes that belong to Bomet Town menu items
      const bometRestRecipes = sourceRestRecipes.filter(r => r.menu_item_id && menuItemIdMap.has(r.menu_item_id));
      let restRecipeCount = 0;

      for (const recipe of bometRestRecipes) {
        const mappedMenuItemId = menuItemIdMap.get(recipe.menu_item_id);
        const { id, created_at, updated_at, menu_item_id, ...rest } = recipe;

        const newRestRecipeData = {
          ...rest,
          menu_item_id: mappedMenuItemId
        };

        const { data: newRestRecipe, error: insRestRecipeErr } = await supabase
          .from('restaurant_recipes')
          .insert([newRestRecipeData])
          .select()
          .single();

        if (!insRestRecipeErr && newRestRecipe) {
          restRecipeCount++;
          // Fetch and clone ingredients
          const { data: sourceIngredients, error: ingErr } = await supabase
            .from('restaurant_recipe_ingredients')
            .select('*')
            .eq('recipe_id', recipe.id);

          if (!ingErr && sourceIngredients && sourceIngredients.length > 0) {
            const ingredientsToInsert = sourceIngredients.map(ing => {
              const { id, recipe_id, ...restIng } = ing;
              return {
                ...restIng,
                recipe_id: newRestRecipe.id
              };
            });

            await supabase.from('restaurant_recipe_ingredients').insert(ingredientsToInsert);
          }
        }
      }
      logger.info(`Successfully cloned ${restRecipeCount} restaurant_recipes and ingredients.`);
    }

    // 11. Clone simple_items
    logger.info(`Cloning simple_items...`);
    const { data: sourceSimpleItems, error: simpleItemsErr } = await supabase
      .from('simple_items')
      .select('*')
      .eq('branch_id', sourceBranchId);

    if (simpleItemsErr) throw new Error(`Failed to fetch source simple items: ${simpleItemsErr.message}`);

    if (sourceSimpleItems && sourceSimpleItems.length > 0) {
      const simpleItemsToInsert = sourceSimpleItems.map(item => {
        // Omit item_sku and unit because they conflict with sku and unit_of_measure on insert
        const { id, created_at, updated_at, branch_id, item_sku, unit, ...rest } = item;
        return {
          ...rest,
          branch_id: targetBranchId
        };
      });

      const { data: newSimpleItems, error: insSimpleItemsErr } = await supabase
        .from('simple_items')
        .insert(simpleItemsToInsert)
        .select();

      if (insSimpleItemsErr) throw new Error(`Failed to insert cloned simple items: ${insSimpleItemsErr.message}`);
      logger.info(`Successfully cloned ${newSimpleItems?.length} simple_items.`);
    }

    logger.info(`Configuration clone completed successfully for branch ${targetBranchName} (ID: ${targetBranchId})!`);
  } catch (err: any) {
    logger.error(`Error during branch configuration cloning: ${err.message || err}`);
    throw err;
  }
};
