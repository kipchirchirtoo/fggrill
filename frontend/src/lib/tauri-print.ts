/**
 * tauri-print.ts — Cross-platform print utility
 * 
 * Works in both browser and Tauri desktop environments.
 * Falls back to iframe-based printing when window.open is blocked.
 */

/** Detect if we're running inside the Tauri webview */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
};

/**
 * Open a print window with the given HTML content.
 * 
 * Strategy:
 * 1. Try window.open (works in browsers)
 * 2. If blocked/null (Tauri), use hidden iframe approach
 * 
 * @param html - Full HTML document string
 * @param options - width, height for the popup window
 */
export function printHtml(
  html: string,
  options: { width?: number; height?: number; title?: string } = {}
): void {
  const { width = 900, height = 800, title = 'Print Preview' } = options;

  // ── Strategy 1: window.open (browser) ──────────────────────────────────
  if (!isTauri()) {
    const printWindow = window.open('', '_blank', `width=${width},height=${height}`);
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  }

  // ── Strategy 2: Hidden iframe (Tauri fallback) ─────────────────────────
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
 * Open a blob URL (for jsPDF) in a printable window.
 * In Tauri, creates an iframe to display the PDF blob.
 */
export function openBlobForPrint(blobUrl: string): void {
  if (!isTauri()) {
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) return;
  }

  // Fallback: open in an iframe
  const existingFrame = document.getElementById('__fg_pdf_frame') as HTMLIFrameElement;
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__fg_pdf_frame';
  iframe.src = blobUrl;
  iframe.style.cssText = 'position:fixed;top:5%;left:5%;width:90%;height:90%;z-index:99999;border:2px solid #333;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.4);background:white;';
  
  // Add a close button overlay
  const overlay = document.createElement('div');
  overlay.id = '__fg_pdf_overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99998;';
  overlay.onclick = () => {
    iframe.remove();
    overlay.remove();
  };

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕ Close Preview';
  closeBtn.style.cssText = 'position:fixed;top:2%;right:6%;z-index:100000;background:#111;color:white;border:none;padding:8px 20px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;';
  closeBtn.onclick = () => {
    iframe.remove();
    overlay.remove();
    closeBtn.remove();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(iframe);
  document.body.appendChild(closeBtn);
}
