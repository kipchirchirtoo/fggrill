// Famous Gates Hotels — Download Commands
// Handles file downloads with proper file system access and notifications

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Manager};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub filename: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResponse {
    pub success: bool,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveFileRequest {
    pub data: Vec<u8>,
    pub filename: String,
    pub content_type: Option<String>,
}

/// Download a file from URL and save to user's Downloads folder
#[command]
pub async fn cmd_download_file(
    app: AppHandle,
    request: DownloadRequest,
) -> Result<DownloadResponse, String> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    use tauri_plugin_notification::NotificationExt;
    
    // Get Downloads directory
    let downloads_dir = match app.path().download_dir() {
        Ok(dir) => dir,
        Err(e) => {
            return Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some(format!("Failed to get downloads directory: {}", e)),
            });
        }
    };
    
    let file_path = downloads_dir.join(&request.filename);
    
    // Check if file already exists and ask user
    if file_path.exists() {
        let overwrite = app
            .dialog()
            .message(format!("File '{}' already exists. Do you want to overwrite it?", request.filename))
            .kind(MessageDialogKind::Warning)
            .blocking_show();
            
        if !overwrite {
            return Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some("Download cancelled by user".to_string()),
            });
        }
    }
    
    // Download the file
    match download_from_url(&request.url, &file_path).await {
        Ok(_) => {
            // Show success notification
            let _ = app
                .notification()
                .builder()
                .title("Download Complete")
                .body(&format!("Successfully downloaded {}", request.filename))
                .show();
                
            Ok(DownloadResponse {
                success: true,
                file_path: Some(file_path.to_string_lossy().to_string()),
                error: None,
            })
        }
        Err(e) => {
            // Show error notification
            let _ = app
                .notification()
                .builder()
                .title("Download Failed")
                .body(&format!("Failed to download {}: {}", request.filename, e))
                .show();
                
            Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Save binary data to a file with file dialog
#[command]
pub async fn cmd_save_file(
    app: AppHandle,
    request: SaveFileRequest,
) -> Result<DownloadResponse, String> {
    use tauri_plugin_dialog::DialogExt;
    use tauri_plugin_notification::NotificationExt;
    
    // Show save dialog
    let file_path = match app
        .dialog()
        .file()
        .set_file_name(&request.filename)
        .blocking_save_file()
    {
        Some(path) => path,
        None => {
            return Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some("Save cancelled by user".to_string()),
            });
        }
    };
    
    // Convert FilePath to PathBuf for writing
    let file_path_buf: PathBuf = file_path.into();
    
    // Write the file using std::fs
    match fs::write(&file_path_buf, &request.data) {
        Ok(_) => {
            // Show success notification
            let file_name = file_path_buf.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let _ = app
                .notification()
                .builder()
                .title("File Saved")
                .body(&format!("Successfully saved {}", file_name))
                .show();
                
            Ok(DownloadResponse {
                success: true,
                file_path: Some(file_path_buf.to_string_lossy().to_string()),
                error: None,
            })
        }
        Err(e) => {
            // Show error notification
            let _ = app
                .notification()
                .builder()
                .title("Save Failed")
                .body(&format!("Failed to save file: {}", e))
                .show();
                
            Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Save binary data directly to Downloads folder
#[command]
pub async fn cmd_save_to_downloads(
    app: AppHandle,
    request: SaveFileRequest,
) -> Result<DownloadResponse, String> {
    use tauri_plugin_notification::NotificationExt;
    
    // Get Downloads directory
    let downloads_dir = match app.path().download_dir() {
        Ok(dir) => dir,
        Err(e) => {
            return Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some(format!("Failed to get downloads directory: {}", e)),
            });
        }
    };
    
    let file_path = downloads_dir.join(&request.filename);
    
    // Write the file using std::fs
    match fs::write(&file_path, &request.data) {
        Ok(_) => {
            // Show success notification
            let _ = app
                .notification()
                .builder()
                .title("Download Complete")
                .body(&format!("Successfully downloaded {} to Downloads folder", request.filename))
                .show();
                
            Ok(DownloadResponse {
                success: true,
                file_path: Some(file_path.to_string_lossy().to_string()),
                error: None,
            })
        }
        Err(e) => {
            // Show error notification
            let _ = app
                .notification()
                .builder()
                .title("Download Failed")
                .body(&format!("Failed to save {}: {}", request.filename, e))
                .show();
                
            Ok(DownloadResponse {
                success: false,
                file_path: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Open the Downloads folder in file explorer
#[command]
pub async fn cmd_open_downloads_folder(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_shell::ShellExt;
    
    let downloads_dir = match app.path().download_dir() {
        Ok(dir) => dir,
        Err(e) => return Err(format!("Failed to get downloads directory: {}", e)),
    };
    
    match app.shell().open(downloads_dir.to_string_lossy(), None) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to open downloads folder: {}", e)),
    }
}

/// Show a notification
#[command]
pub async fn cmd_show_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<bool, String> {
    use tauri_plugin_notification::NotificationExt;
    
    match app
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
    {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to show notification: {}", e)),
    }
}

/// Helper function to download from URL
async fn download_from_url(url: &str, file_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let response = reqwest::get(url).await?;
    let bytes = response.bytes().await?;
    std::fs::write(file_path, bytes)?;
    Ok(())
}