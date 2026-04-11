/**
 * tauri-print.ts — Cross-platform print utility
 * 
 * Works in both browser and Tauri desktop environments.
 * Falls back to iframe-based printing when window.open is blocked.
 */

/** Detect if we're running inside the Tauri webview (or embedded iframe within it) */
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Direct Tauri webview — globals injected by withGlobalTauri
  if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) return true;
  // Persistent flag set by the shell on first load (survives SPA navigation)
  if ((window as any).__FG_DESKTOP__ === true) return true;
  // Check sessionStorage — set once on first load with fg_desktop=1
  try {
    if (sessionStorage.getItem('fg_desktop') === '1') return true;
  } catch (_) { /* ignore */ }
  // Embedded inside a Tauri iframe (RemoteWebView) — check URL param set by the shell
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fg_desktop') === '1') {
      // Persist it so navigation doesn't lose it
      try { sessionStorage.setItem('fg_desktop', '1'); } catch (_) { /* ignore */ }
      return true;
    }
  } catch (_) { /* ignore */ }
  // Try parent frame globals (same-origin only)
  try {
    if ((window.top as any)?.__TAURI_INTERNALS__ || (window.top as any)?.__TAURI__) return true;
  } catch (_) { /* cross-origin — ignore */ }
  return false;
};

/**
 * Helper to convert a Blob URL (or Blob) to a Base64 Data URL.
 * Better for passing between Tauri windows.
 */
async function blobToDataUrl(blobUrl: string): Promise<string> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[PrintHelper] Blob conversion failed:', e);
    return blobUrl; // Fallback to original
  }
}

/**
 * Open a print window with the given HTML content.
 * 
 * @param html - Full HTML document string
 * @param options - width, height for the popup window
 */
export async function printHtml(
  html: string,
  options: { width?: number; height?: number; title?: string } = {}
): Promise<void> {
  const { width = 900, height = 800, title = 'Print Preview' } = options;

  // In Tauri, data: URLs are not supported by WebviewUrl::External without the
  // 'webview-data-url' feature flag. Use the iframe approach for all HTML printing.

  // ── Strategy 1: window.open (browser) ──────────────────────────────────
  if (!isTauri()) {
    const printWindow = window.open('', '_blank', `width=${width},height=${height}`);
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  }

  // ── Strategy 2: Hidden iframe (Tauri fallback / Browser popup blocked) ──
  // Create a hidden iframe, write the HTML, and trigger print
  const existingFrame = document.getElementById('__fg_print_frame') as HTMLIFrameElement;
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = '__fg_print_frame';
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error('[PrintHelper] Could not access iframe document');
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render, then print
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('[PrintHelper] Print failed:', e);
    }

    // Clean up after printing (give the print dialog time to appear)
    setTimeout(() => {
      iframe.remove();
    }, 2000);
  };

  // Trigger load if content was written synchronously
  setTimeout(() => {
    if (iframe.parentNode) {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        // Already handled
      }
      setTimeout(() => iframe.remove(), 2000);
    }
  }, 500);
}

/**
 * Open a blob URL (for jsPDF) in a printable overlay.
 * Uses an iframe overlay — works in both browser and Tauri (no data: URL window needed).
 * The overlay includes Print and Download buttons.
 */
export async function openBlobForPrint(blobUrl: string, filename?: string): Promise<void> {
  // Detect if we're inside any iframe (Tauri RemoteWebView, or browser popup blocked)
  const isInsideIframe = (() => { try { return window.self !== window.top; } catch (_e) { return true; } })();

  // In plain browser tab (not iframe, not Tauri), try window.open first — simplest UX
  if (!isTauri() && !isInsideIframe) {
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) return;
  }

  // In Tauri WebView2 OR any iframe: blob: URLs are blocked by Edge security policy.
  // ALWAYS convert to base64 data URL — this works everywhere without restrictions.
  let srcUrl = blobUrl;
  try {
    srcUrl = await blobToDataUrl(blobUrl);
  } catch (_) {
    // If conversion fails, fall through with original blob URL
  }

  const existingFrame = document.getElementById('__fg_pdf_frame') as HTMLIFrameElement;
  if (existingFrame) existingFrame.remove();
  const existingOverlay = document.getElementById('__fg_pdf_overlay');
  if (existingOverlay) existingOverlay.remove();
  const existingToolbar = document.getElementById('__fg_pdf_toolbar');
  if (existingToolbar) existingToolbar.remove();

  const overlay = document.createElement('div');
  overlay.id = '__fg_pdf_overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99998;';

  const iframe = document.createElement('iframe');
  iframe.id = '__fg_pdf_frame';
  iframe.src = srcUrl;
  iframe.style.cssText = 'position:fixed;top:48px;left:5%;width:90%;height:calc(90% - 48px);z-index:99999;border:none;border-radius:0 0 8px 8px;box-shadow:0 20px 60px rgba(0,0,0,0.4);background:white;';

  // Toolbar with Print + Download + Close
  const toolbar = document.createElement('div');
  toolbar.id = '__fg_pdf_toolbar';
  toolbar.style.cssText = 'position:fixed;top:5%;left:5%;width:90%;height:40px;z-index:100000;background:#1a1a1a;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;padding:0 12px;gap:8px;';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = filename ? `📄 ${filename}` : '📄 Document Preview';
  titleSpan.style.cssText = 'color:#ccc;font-size:13px;font-family:system-ui,sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

  const btnStyle = 'border:none;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;';

  const printBtn = document.createElement('button');
  printBtn.innerHTML = '🖨 Print';
  printBtn.style.cssText = btnStyle + 'background:#007AFF;color:white;';
  printBtn.onclick = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (_) {
      // If iframe print is blocked, open in new tab
      const a = document.createElement('a');
      a.href = srcUrl;
      a.target = '_blank';
      a.click();
    }
  };

  const downloadBtn = document.createElement('button');
  downloadBtn.innerHTML = '⬇ Download';
  downloadBtn.style.cssText = btnStyle + 'background:#34C759;color:white;';
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = srcUrl;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕ Close';
  closeBtn.style.cssText = btnStyle + 'background:#3a3a3a;color:#ccc;';

  const cleanup = () => {
    iframe.remove();
    overlay.remove();
    toolbar.remove();
  };

  overlay.onclick = cleanup;
  closeBtn.onclick = cleanup;

  toolbar.appendChild(titleSpan);
  toolbar.appendChild(printBtn);
  toolbar.appendChild(downloadBtn);
  toolbar.appendChild(closeBtn);

  document.body.appendChild(overlay);
  document.body.appendChild(toolbar);
  document.body.appendChild(iframe);
}
