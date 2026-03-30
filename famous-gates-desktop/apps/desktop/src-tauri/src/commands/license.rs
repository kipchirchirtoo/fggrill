// License command — validates a branch license key against Supabase

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use reqwest::Client;
use serde_json::json;

const SUPABASE_URL: &str = env!("SUPABASE_URL");
const SUPABASE_ANON_KEY: &str = env!("SUPABASE_ANON_KEY");

/// Validate a branch license key against the Supabase `license_keys` table.
/// On success, persists `{ key, branch_id, verified_at }` to `license.dat`.
/// On failure (no match or network error), returns `Err("Invalid license")`.
#[tauri::command]
pub async fn cmd_verify_license(
    app: AppHandle,
    key: String,
    branch_id: i64,
) -> Result<(), String> {
    let url = format!(
        "{}/rest/v1/license_keys?key=eq.{}&branch_id=eq.{}&is_active=eq.true",
        SUPABASE_URL, key, branch_id
    );

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|_| "Invalid license".to_string())?;

    let rows: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "Invalid license".to_string())?;

    // Must be a non-empty array to be valid
    let is_valid = rows
        .as_array()
        .map(|arr| !arr.is_empty())
        .unwrap_or(false);

    if !is_valid {
        return Err("Invalid license".to_string());
    }

    // Persist to license.dat store
    let store = app.store("license.dat").map_err(|e| e.to_string())?;
    store.set(
        "license",
        json!({
            "key": key,
            "branch_id": branch_id,
            "verified_at": chrono::Utc::now().to_rfc3339()
        }),
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
#[path = "license_tests.rs"]
mod license_tests;
