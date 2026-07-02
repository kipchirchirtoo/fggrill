const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data } = await supabase.from("inventory_items")
    .select("category")
    .eq("is_active", true)
    .not("category", "eq", "KITCHEN MENU");
  const counts = {};
  for (const r of (data || [])) {
    const c = r.category || "null";
    counts[c] = (counts[c] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  console.log("Category distribution:");
  for (const [cat, n] of sorted) console.log(`  ${cat}: ${n}`);
}
main().catch(console.error);
