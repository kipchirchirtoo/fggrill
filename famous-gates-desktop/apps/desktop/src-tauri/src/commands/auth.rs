// Auth commands — login, logout, session management

use tauri::State;
use serde_json::json;
use crate::state::AppState;
use crate::services::{http::ApiClient, security};
use crate::models::auth::AuthResponse;

/// Standard email/password login — calls Node API, stores token securely
#[tauri::command]
pub async fn cmd_login(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let client = ApiClient::new(None, None);
    let body = json!({ "email": email, "password": password });

    let resp = client
        .post_node("/auth/login", &body)
        .await
        .map_err(|e| e.to_string())?;

    let auth: AuthResponse = serde_json::from_value(resp).map_err(|e| e.to_string())?;

    if auth.success {
        if let Some(data) = &auth.data {
            let token = &data.session.access_token;
            // Store token in OS keychain
            security::store_token("auth_token", token).map_err(|e| e.to_string())?;

            // Update in-memory session
            let user = &data.user;
            let mut session = state.session.lock().unwrap();
            *session = Some(crate::state::SessionState {
                user_id: user.id.clone(),
                email: user.email.clone(),
                role: user.role.clone(),
                branch_id: user.branch_id,
                branch_name: user.branch_name.clone(),
                token: token.clone(),
                expires_at: chrono::Utc::now().timestamp() + 86400,
            });
        }
    }

    Ok(auth)
}

/// PIN-based POS login
#[tauri::command]
pub async fn cmd_pos_login(
    pin: String,
    branch_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let client = ApiClient::new(None, None);
    let body = json!({ "pin": pin, "branch_id": branch_id });

    let resp = client
        .post_node("/auth/pos-login", &body)
        .await
        .map_err(|e| e.to_string())?;

    let auth: AuthResponse = serde_json::from_value(resp).map_err(|e| e.to_string())?;

    if auth.success {
        if let Some(data) = &auth.data {
            let token = &data.session.access_token;
            security::store_token("pos_token", token).map_err(|e| e.to_string())?;
            let mut session = state.session.lock().unwrap();
            let user = &data.user;
            *session = Some(crate::state::SessionState {
                user_id: user.id.clone(),
                email: user.email.clone(),
                role: user.role.clone(),
                branch_id: user.branch_id,
                branch_name: user.branch_name.clone(),
                token: token.clone(),
                expires_at: chrono::Utc::now().timestamp() + 43200,
            });
        }
    }

    Ok(auth)
}

/// Clear session and remove stored token
#[tauri::command]
pub async fn cmd_logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.session.lock().unwrap();
    *session = None;
    security::delete_token("auth_token").map_err(|e| e.to_string())?;
    security::delete_token("pos_token").map_err(|e| e.to_string())?;
    Ok(())
}

/// Return current session state to the frontend
#[tauri::command]
pub async fn cmd_get_session(
    state: State<'_, AppState>,
) -> Result<Option<crate::state::SessionState>, String> {
    let session = state.session.lock().unwrap();
    Ok(session.clone())
}

/// Refresh the auth token
#[tauri::command]
pub async fn cmd_refresh_token(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let token = {
        let session = state.session.lock().unwrap();
        session.as_ref().map(|s| s.token.clone())
    };

    if let Some(t) = token {
        let client = ApiClient::new(Some(t), None);
        let resp = client
            .post_node("/auth/refresh-token", &json!({}))
            .await
            .map_err(|e| e.to_string())?;

        if let Some(new_token) = resp.get("token").and_then(|v| v.as_str()) {
            security::store_token("auth_token", new_token).map_err(|e| e.to_string())?;
            let mut session = state.session.lock().unwrap();
            if let Some(s) = session.as_mut() {
                s.token = new_token.to_string();
                s.expires_at = chrono::Utc::now().timestamp() + 86400;
            }
            return Ok(true);
        }
    }

    Ok(false)
}
