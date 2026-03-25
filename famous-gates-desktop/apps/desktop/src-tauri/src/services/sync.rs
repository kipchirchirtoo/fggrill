// Sync engine — outbox replay, conflict detection, background worker

use anyhow::Result;
use tauri::{AppHandle, Emitter};
use crate::services::http::ApiClient;
use crate::models::sync::SyncResult;

const SYNC_INTERVAL_SECS: u64 = 30;
const MAX_RETRIES: i32 = 5;

/// Starts the background sync worker — runs every SYNC_INTERVAL_SECS seconds.
pub async fn start_sync_worker(app: AppHandle) {
    log::info!("[Sync] Background worker started");
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(SYNC_INTERVAL_SECS)).await;

        // Check network before attempting sync
        if !ApiClient::ping_node().await {
            log::debug!("[Sync] Offline — skipping sync cycle");
            continue;
        }

        match run_sync_cycle(&app).await {
            Ok(result) => {
                log::info!(
                    "[Sync] Cycle complete — synced: {}, failed: {}, skipped: {}",
                    result.synced,
                    result.failed,
                    result.skipped
                );
                // Emit sync result to frontend
                let _ = app.emit("sync:complete", &result);
            }
            Err(e) => {
                log::error!("[Sync] Cycle error: {e}");
                let _ = app.emit("sync:error", e.to_string());
            }
        }
    }
}

/// Runs one full sync cycle — reads outbox, replays mutations, marks clean.
pub async fn run_sync_cycle(app: &AppHandle) -> Result<SyncResult> {
    use tauri::Manager;
    use crate::state::AppState;
    use crate::models::outbox::{OutboxEntry, OutboxStatus};
    use rusqlite::params;

    let state = app.state::<AppState>();
    let (token, branch_id) = {
        let session = state.session.lock().unwrap();
        (
            session.as_ref().map(|s| s.token.clone()),
            session.as_ref().and_then(|s| s.branch_id),
        )
    };

    // 1. Fetch pending entries (scoped to drop connection before await)
    let entries = {
        let conn = crate::services::sqlite::get_connection(app)?;
        let mut stmt = conn.prepare(
            "SELECT id, entity, operation, payload, endpoint, method, created_at, retry_count, last_error, status 
             FROM outbox 
             WHERE status IN ('PENDING', 'RETRYING') 
             ORDER BY created_at ASC 
             LIMIT 50"
        )?;

        let entries = stmt.query_map([], |row| {
            let status_str: String = row.get(9)?;
            let status = match status_str.as_str() {
                "PENDING" => OutboxStatus::Pending,
                "RETRYING" => OutboxStatus::Retrying,
                "FAILED" => OutboxStatus::Failed,
                "SYNCED" => OutboxStatus::Synced,
                _ => OutboxStatus::Pending,
            };

            Ok(OutboxEntry {
                id: row.get(0)?,
                entity: row.get(1)?,
                operation: row.get(2)?,
                payload: row.get(3)?,
                endpoint: row.get(4)?,
                method: row.get(5)?,
                created_at: row.get(6)?,
                retry_count: row.get(7)?,
                last_error: row.get(8)?,
                status,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        entries
    };

    let mut result = SyncResult {
        synced: 0,
        failed: 0,
        skipped: 0,
        errors: vec![],
    };

    if entries.is_empty() {
        return Ok(result);
    }

    let client = ApiClient::new(token, branch_id);

    // 2. Process each entry
    for entry in entries {
        let payload: serde_json::Value = serde_json::from_str(&entry.payload)?;
        
        log::info!("[Sync] Replaying {} {} to {}", entry.method, entry.entity, entry.endpoint);
        
        // API Call (This is an await point)
        let api_res = match entry.method.as_str() {
            "POST" => client.post_node(&entry.endpoint, &payload).await,
            "PUT" => client.put_node(&entry.endpoint, &payload).await,
            "PATCH" => client.patch_node(&entry.endpoint, &payload).await,
            "DELETE" => client.delete_node(&entry.endpoint, &payload).await,
            _ => Err(anyhow::anyhow!("Unsupported method: {}", entry.method)),
        };

        // 3. Update status (new connection per update to avoid holding across iterations)
        let conn = crate::services::sqlite::get_connection(app)?;
        match api_res {
            Ok(_) => {
                conn.execute(
                    "UPDATE outbox SET status = 'SYNCED', synced_at = unixepoch(), updated_at = unixepoch() WHERE id = ?",
                    [entry.id],
                )?;
                result.synced += 1;
            }
            Err(e) => {
                let new_retry_count = entry.retry_count + 1;
                let new_status = if should_retry(new_retry_count) {
                    "RETRYING"
                } else {
                    "FAILED"
                };
                
                conn.execute(
                    "UPDATE outbox SET status = ?, retry_count = ?, last_error = ?, updated_at = unixepoch() WHERE id = ?",
                    params![new_status, new_retry_count, e.to_string(), entry.id],
                )?;
                
                result.failed += 1;
                result.errors.push(format!("Entry {}: {}", entry.id, e));
            }
        }
    }

    // 4. Update outbox count in state
    let count: usize = {
        let conn = crate::services::sqlite::get_connection(app)?;
        conn.query_row(
            "SELECT COUNT(*) FROM outbox WHERE status IN ('PENDING', 'RETRYING')",
            [],
            |row| row.get(0),
        )?
    };
    
    {
        let mut sync_state = state.sync.lock().unwrap();
        sync_state.outbox_count = count;
        sync_state.last_sync_at = Some(chrono::Utc::now().timestamp());
    }

    Ok(result)
}

/// Calculates exponential backoff delay for a given retry count
pub fn backoff_delay(retry_count: i32) -> std::time::Duration {
    let secs = std::cmp::min(2_u64.pow(retry_count as u32), 300);
    std::time::Duration::from_secs(secs)
}

/// Returns true if an outbox entry should be retried
pub fn should_retry(retry_count: i32) -> bool {
    retry_count < MAX_RETRIES
}
