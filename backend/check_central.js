const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data, error } = await supabase.from("inventory_items")
    .select("id, sku, item_name, category, unit, quantity, default_unit_cost, reorder_level, is_active, store_type")
    .eq("is_active", true)
    .not("category", "eq", "KITCHEN MENU")
    .not("sku", "like", "MENU-%")
    .not("sku", "like", "FGH-%")
    .order("item_name").limit(3);
  if (error) { console.log("ERROR:", error.message); return; }
  console.log("inventory_items count (sample):", data?.length);
  console.log("sample:", JSON.stringify(data, null, 2));
  const { count } = await supabase.from("inventory_items").select("*", { count: "exact", head: true }).eq("is_active", true);
  console.log("total active inventory_items:", count);
}
main().catch(console.error);
