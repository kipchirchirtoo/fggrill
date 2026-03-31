// License command — validates a branch license key against Supabase

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

/// Validate a branch license key.
/// Debug builds: always succeeds (dev bypass).
/// Release builds: validates against Supabase.
#[tauri::command]
pub async fn cmd_verify_license(
    app: AppHandle,
    key: String,
    branch_id: i64,
) -> Result<(), String> {
    let valid = verify_key(&key, branch_id).await;

    if !valid {
        return Err("Invalid license".to_string());
    }

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

async fn verify_key(key: &str, branch_id: i64) -> bool {
    // Always valid in dev/debug builds
    if cfg!(debug_assertions) {
        return true;
    }

    let supabase_url = env!("SUPABASE_URL");
    let supabase_key = env!("SUPABASE_ANON_KEY");

    let url = format!(
        "{}/rest/v1/license_keys?key=eq.{}&branch_id=eq.{}&is_active=eq.true&select=id",
        supabase_url, key, branch_id
    );

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let response = match client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return false,
    };

    match response.json::<serde_json::Value>().await {
        Ok(rows) => rows.as_array().map(|a| !a.is_empty()).unwrap_or(false),
        Err(_) => false,
    }
}

#[cfg(test)]
#[path = "license_tests.rs"]
mod license_tests;
