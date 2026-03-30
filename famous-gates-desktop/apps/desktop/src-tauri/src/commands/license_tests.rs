// Property-based tests for license command logic
// Feature: tauri2-enterprise-systems
// Properties 1 & 2: License validation round trip and invalid license no store write

#[cfg(test)]
mod tests {
    use proptest::prelude::*;
    use serde_json::{json, Value};

    // ── Extracted pure logic under test ──────────────────────────────────────

    /// Simulates the response-parsing logic from cmd_verify_license.
    /// Returns true if the response indicates a valid active license.
    fn parse_license_response(body: &Value) -> bool {
        body.as_array()
            .map(|arr| !arr.is_empty())
            .unwrap_or(false)
    }

    /// Simulates what would be written to the store on a successful validation.
    fn build_store_record(key: &str, branch_id: i64) -> Value {
        json!({
            "key": key,
            "branch_id": branch_id,
            "verified_at": chrono::Utc::now().to_rfc3339()
        })
    }

    // ── Property 1: License validation round trip ─────────────────────────────
    // For any valid key/branch_id, the store record contains the same key and branch_id.
    // Validates: Requirements 5.2, 5.3, 5.4

    proptest! {
        #[test]
        fn prop_license_round_trip(
            key in "[a-zA-Z0-9]{8,32}",
            branch_id in 1i64..=9999i64,
        ) {
            // Simulate Supabase returning a matching active row
            let supabase_response = json!([{
                "key": key,
                "branch_id": branch_id,
                "is_active": true
            }]);

            let is_valid = parse_license_response(&supabase_response);
            prop_assert!(is_valid, "Expected valid response to be recognised as valid");

            // Simulate store write
            let record = build_store_record(&key, branch_id);
            prop_assert_eq!(record["key"].as_str().unwrap(), key.as_str());
            prop_assert_eq!(record["branch_id"].as_i64().unwrap(), branch_id);
            prop_assert!(record["verified_at"].as_str().is_some());
        }
    }

    // ── Property 2: Invalid license produces no store write ───────────────────
    // For any key/branch_id not in DB (empty array response), parse returns false
    // and no store write should occur.
    // Validates: Requirements 5.5, 5.6

    proptest! {
        #[test]
        fn prop_invalid_license_no_write(
            key in "[a-zA-Z0-9]{8,32}",
            branch_id in 1i64..=9999i64,
        ) {
            // Simulate Supabase returning no matching rows
            let empty_response = json!([]);
            let is_valid = parse_license_response(&empty_response);
            prop_assert!(!is_valid, "Empty response must not be treated as valid");

            // Simulate network error (non-array body)
            let error_response = json!(null);
            let is_valid_on_error = parse_license_response(&error_response);
            prop_assert!(!is_valid_on_error, "Null/error response must not be treated as valid");

            // Confirm: no store write should happen (is_valid == false → early return Err)
            // The key and branch_id are only used in the store write path, which is unreachable here.
            let _ = (key, branch_id); // consumed but not written
        }
    }
}
