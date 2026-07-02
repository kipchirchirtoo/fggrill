const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  // Check what the RPC does - look at its definition via a known-bad call
  // to see error details
  const { data, error } = await supabase.rpc("cashier_acknowledge_item_void", {
    p_request_id: "00000000-0000-0000-0000-000000000001",
    p_actioned_by: "00000000-0000-0000-0000-000000000001"
  });
  console.log("RPC error msg:", error?.message);
  console.log("RPC error details:", error?.details);
  console.log("RPC error hint:", error?.hint);
  
  // Check if pos_item_void_log has duplicate entries for same void request
  const { data: logs } = await supabase
    .from("pos_item_void_log")
    .select("void_request_id, count")
    .select("void_request_id")
    .order("voided_at", { ascending: false })
    .limit(10);
  
  // Count duplicates
  const { data: logAll } = await supabase.from("pos_item_void_log").select("void_request_id");
  const counts = {};
  for (const l of (logAll || [])) {
    counts[l.void_request_id] = (counts[l.void_request_id] || 0) + 1;
  }
  const dups = Object.entries(counts).filter(([k, v]) => v > 1);
  console.log("duplicate void_request_id in log:", dups.length, dups.slice(0, 3));
}
main().catch(console.error);
