/**
 * tauri-downloads.ts — Tauri-specific download utilities
 * 
 * Provides native file system access and notifications for the Tauri desktop app.
 * Falls back to browser behavior when not running in Tauri.
 */

import { isTauri } from './tauri-print';

// Tauri command types
interface DownloadRequest {
  url: string;
  filename: string;
  content_type?: string;
}

interface SaveFileRequest {
  data: number[]; // Vec<u8> in Rust becomes number[] in TypeScript
  filename: string;
  content_type?: string;
}

interface DownloadResponse {
  success: boolean;
  file_path?: string;
  error?: string;
}

// Tauri API imports (only available in Tauri context)
let tauriInvoke: any = null;

if (isTauri()) {
  try {
    // Dynamic import to avoid errors in browser context
    import('@tauri-apps/api/core').then(({ invoke }) => {
      tauriInvoke = invoke;
    });
  } catch (e) {
    console.warn('[TauriDownloads] Tauri API not available:', e);
  }
}

/**
 * Download a file from URL using native Tauri file system
 */
export async function downloadFile(url: string, filename: string): Promise<boolean> {
  if (!isTauri() || !tauriInvoke) {
    // Fallback to browser download
    return browserDownload(url, filename);
  }

  try {
    const request: DownloadRequest = { url, filename };
    const response: DownloadResponse = await tauriInvoke('cmd_download_file', { request });
    
    if (response.success) {
      console.log('[TauriDownloads] File downloaded to:', response.file_path);
      return true;
    } else {
      console.error('[TauriDownloads] Download failed:', response.error);
      return false;
    }
  } catch (error) {
    console.error('[TauriDownloads] Download error:', error);
    return false;
  }
}

/**
 * Save binary data to file with native file dialog
 */
export async function saveFileWithDialog(data: Uint8Array | ArrayBuffer, filename: string): Promise<boolean> {
  if (!isTauri() || !tauriInvoke) {
    // Fallback to browser download
    return browserSaveBlob(data, filename);
  }

  try {
    // Convert to number array for Rust
    const dataArray = Array.from(new Uint8Array(data));
    const request: SaveFileRequest = { data: dataArray, filename };
    const response: DownloadResponse = await tauriInvoke('cmd_save_file', { request });
    
    if (response.success) {
      console.log('[TauriDownloads] File saved to:', response.file_path);
      return true;
    } else {
      console.error('[TauriDownloads] Save failed:', response.error);
      return false;
    }
  } catch (error) {
    console.error('[TauriDownloads] Save error:', error);
    return false;
  }
}

/**
 * Save binary data directly to Downloads folder
 */
export async function saveToDownloads(data: Uint8Array | ArrayBuffer, filename: string): Promise<boolean> {
  if (!isTauri() || !tauriInvoke) {
    // Fallback to browser download
    return browserSaveBlob(data, filename);
  }

  try {
    // Convert to number array for Rust
    const dataArray = Array.from(new Uint8Array(data));
    const request: SaveFileRequest = { data: dataArray, filename };
    const response: DownloadResponse = await tauriInvoke('cmd_save_to_downloads', { request });
    
    if (response.success) {
      console.log('[TauriDownloads] File saved to Downloads:', response.file_path);
      return true;
    } else {
      console.error('[TauriDownloads] Save to Downloads failed:', response.error);
      return false;
    }
  } catch (error) {
    console.error('[TauriDownloads] Save to Downloads error:', error);
    return false;
  }
}

/**
 * Open the Downloads folder in file explorer
 */
export async function openDownloadsFolder(): Promise<boolean> {
  if (!isTauri() || !tauriInvoke) {
    console.warn('[TauriDownloads] Cannot open Downloads folder in browser');
    return false;
  }

  try {
    const success: boolean = await tauriInvoke('cmd_open_downloads_folder');
    return success;
  } catch (error) {
    console.error('[TauriDownloads] Failed to open Downloads folder:', error);
    return false;
  }
}

/**
 * Show a native notification
 */
export async function showNotification(title: string, body: string): Promise<boolean> {
  if (!isTauri() || !tauriInvoke) {
    // Fallback to browser notification
    return browserNotification(title, body);
  }

  try {
    const success: boolean = await tauriInvoke('cmd_show_notification', { title, body });
    return success;
  } catch (error) {
    console.error('[TauriDownloads] Failed to show notification:', error);
    return false;
  }
}

/**
 * Enhanced download function that handles both URLs and Blobs
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  if (!isTauri()) {
    // Browser fallback
    return browserSaveBlob(blob, filename);
  }

  try {
    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer();
    return await saveToDownloads(arrayBuffer, filename);
  } catch (error) {
    console.error('[TauriDownloads] Blob download error:', error);
    return false;
  }
}

/**
 * Enhanced function to replace the standard PDF export pattern
 */
export async function exportPDF(pdfBlob: Blob, filename: string): Promise<boolean> {
  if (isTauri()) {
    // Use native Tauri download with notification
    const success = await downloadBlob(pdfBlob, filename);
    if (success) {
      await showNotification('Export Complete', `${filename} has been saved to your Downloads folder`);
    }
    return success;
  } else {
    // Browser fallback
    return browserSaveBlob(pdfBlob, filename);
  }
}

// Browser fallback functions
function browserDownload(url: string, filename: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (error) {
    console.error('[TauriDownloads] Browser download failed:', error);
    return false;
  }
}

function browserSaveBlob(data: Uint8Array | ArrayBuffer | Blob, filename: string): boolean {
  try {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else {
      blob = new Blob([data], { type: 'application/octet-stream' });
    }
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('[TauriDownloads] Browser save failed:', error);
    return false;
  }
}

function browserNotification(title: string, body: string): boolean {
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body });
          }
        });
        return true;
      }
    }
    
    // Fallback to console
    console.log(`[Notification] ${title}: ${body}`);
    return false;
  } catch (error) {
    console.error('[TauriDownloads] Browser notification failed:', error);
    return false;
  }
}

/**
 * Utility to detect if we should use Tauri downloads
 */
export function shouldUseTauriDownloads(): boolean {
  return isTauri() && tauriInvoke !== null;
}

/**
 * Get the appropriate download function based on environment
 */
export function getDownloadFunction() {
  return shouldUseTauriDownloads() ? exportPDF : browserSaveBlob;
}