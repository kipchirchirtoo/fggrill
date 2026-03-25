// Data commands — offline-first read/write bridge

use tauri::State;
use serde_json::Value;
use crate::state::AppState;
use rusqlite::OptionalExtension;

/// Query local SQLite cache — returns cached JSON for a given entity + key
#[tauri::command]
pub async fn cmd_query_local(
    app: tauri::AppHandle,
    entity: String,
    key: Option<String>,
) -> Result<Option<Value>, String> {
    let conn = crate::services::sqlite::get_connection(&app).map_err(|e| e.to_string())?;
    
    let table_name = match entity.as_str() {
        "bookings" => Some("local_bookings"),
        "rooms" => Some("local_rooms"),
        "staff" => Some("local_staff"),
        "menu_items" => Some("local_menu_items"),
        "orders" => Some("local_orders"),
        "inventory" => Some("local_inventory"),
        _ => None,
    };

    let table = match table_name {
        Some(t) => t,
        None => return Ok(None),
    };

    let query = if key.is_some() {
        format!("SELECT payload FROM {} WHERE id = ?", table)
    } else {
        format!("SELECT json_group_array(json(payload)) FROM {}", table)
    };

    let result: Option<String> = if let Some(ref k) = key {
        conn.query_row(&query, [k], |row| row.get(0)).optional().map_err(|e| e.to_string())?
    } else {
        conn.query_row(&query, [], |row| row.get(0)).optional().map_err(|e| e.to_string())?
    };

    match result {
        Some(json_str) => {
            let val: Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
            Ok(Some(val))
        }
        None => Ok(None),
    }
}

/// Return a cached value by cache key
#[tauri::command]
pub async fn cmd_get_cached(cache_key: String) -> Result<Option<String>, String> {
    // TODO: SELECT value FROM cache_metadata WHERE key = ? AND expires_at > now()
    log::debug!("[Data] Cache lookup: {cache_key}");
    Ok(None)
}

/// Offline-first mutation — writes to SQLite immediately, queues in outbox
#[tauri::command]
pub async fn cmd_mutate(
    app: tauri::AppHandle,
    entity: String,
    operation: String,   // CREATE | UPDATE | DELETE
    endpoint: String,    // e.g. /bookings or /bookings/uuid
    method: String,      // POST | PUT | PATCH | DELETE
    payload: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let payload_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

    // 1. Write to local SQLite outbox
    let conn = crate::services::sqlite::get_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO outbox (id, entity, operation, endpoint, method, payload, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)",
        rusqlite::params![id, entity, operation, endpoint, method, payload_str, now, now],
    ).map_err(|e| e.to_string())?;

    // 2. Update local entity table if it exists (Optimistic UI)
    // Map entity to table: bookings -> local_bookings, etc.
    let table_name = match entity.as_str() {
        "bookings" => Some("local_bookings"),
        "rooms" => Some("local_rooms"),
        "staff" => Some("local_staff"),
        "menu_items" => Some("local_menu_items"),
        "orders" => Some("local_orders"),
        "inventory" => Some("local_inventory"),
        _ => None,
    };

    if let Some(table) = table_name {
        // Basic optimistic update for CREATE/UPDATE
        // Note: For a real app, we'd need to extract fields from the payload
        // For now, we at least update the payload blob and sync status
        if operation == "CREATE" || operation == "UPDATE" {
            let entity_id = payload.get("id").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
            let _ = conn.execute(
                &format!("INSERT INTO {} (id, payload, created_at) VALUES (?, ?, ?) 
                          ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", table),
                rusqlite::params![entity_id, payload_str, now],
            );
        } else if operation == "DELETE" {
            let entity_id = payload.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !entity_id.is_empty() {
                let _ = conn.execute(&format!("DELETE FROM {} WHERE id = ?", table), [entity_id]);
            }
        }
    }

    log::info!("[Data] Queued mutation: {operation} {entity} → {endpoint} (ID: {id})");

    // 3. Update outbox count in state
    {
        let mut sync = state.sync.lock().unwrap();
        sync.outbox_count += 1;
    }

    // 4. If online, attempt immediate sync cycle
    let is_online = {
        let net = state.network.lock().unwrap();
        net.is_online
    };

    if is_online {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let _ = crate::services::sync::run_sync_cycle(&app_clone).await;
        });
    }

    // Return optimistic response
    Ok(serde_json::json!({
        "success": true,
        "offline": true,
        "queued_id": id,
        "message": "Saved locally — will sync when online"
    }))
}
