const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  // Check if the RPC exists
  const { data, error } = await supabase.rpc("cashier_acknowledge_item_void", {
    p_request_id: "00000000-0000-0000-0000-000000000000",
    p_actioned_by: "00000000-0000-0000-0000-000000000000"
  });
  console.log("RPC cashier_acknowledge_item_void error:", error?.message || "no error (exists)");

  // Check pos_item_void_log columns
  const { data: logSample, error: logErr } = await supabase.from("pos_item_void_log").select("*").limit(1);
  console.log("pos_item_void_log columns:", logSample ? Object.keys(logSample[0] || {}) : "empty/error", logErr?.message || "");

  // Check pos_item_void_requests columns
  const { data: reqSample, error: reqErr } = await supabase.from("pos_item_void_requests").select("*").limit(1);
  console.log("pos_item_void_requests columns:", reqSample ? Object.keys(reqSample[0] || {}) : "empty/error", reqErr?.message || "");

  // Check how many void requests exist and their statuses
  const { data: statuses } = await supabase.from("pos_item_void_requests").select("status");
  const counts = {};
  for (const r of (statuses || [])) { counts[r.status] = (counts[r.status]||0)+1; }
  console.log("void request statuses:", counts);

  // Check pos_shift_orders total_amount/balance_amount/items structure sample
  const { data: order } = await supabase.from("pos_shift_orders").select("id, total_amount, balance_amount, items").limit(1).single();
  if (order) {
    console.log("sample order total_amount:", order.total_amount, "balance_amount:", order.balance_amount);
    const items = order.items || [];
    console.log("sample order item[0]:", JSON.stringify(items[0] || {}));
  }
}
main().catch(console.error);
