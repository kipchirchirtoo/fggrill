import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateProvider';
import { Loader2 } from 'lucide-react';

interface RemoteWebViewProps {
  targetPath: string;
}

export function RemoteWebView({ targetPath }: RemoteWebViewProps) {
  const { session } = useAppState();
  const [frameLoading, setFrameLoading] = useState(true);

  // Production frontend URL
  const baseUrl = 'https://famousgate.hirall.com';

  const token = session?.token ?? '';
  const branchId = session?.branch_id ?? '';
  const sep = targetPath.includes('?') ? '&' : '?';
  const remoteUrl = `${baseUrl}${targetPath}${sep}desktop_token=${encodeURIComponent(token)}&fg_branch_id=${encodeURIComponent(branchId)}&fg_desktop=1`;

  return (
    // Full viewport — no border, no padding, no rounding.
    // The RemoteShell layout already removes sidebar/topbar,
    // so this div simply ensures the iframe fills the whole available space.
    <div className="fixed inset-0 bg-white">
      {frameLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white">
          <Loader2 className="h-10 w-10 animate-spin text-stone-900" />
          <p className="text-xs font-black text-stone-500 uppercase tracking-widest">
            Loading Famous Gate Hotels...
          </p>
        </div>
      )}
      <iframe
        key={remoteUrl}
        src={remoteUrl}
        className="h-full w-full border-0"
        title={`Famous Gates: ${targetPath}`}
        onLoad={(e) => {
          setFrameLoading(false);
          // Persist the desktop flag in the iframe's sessionStorage so it
          // survives SPA navigation (Next.js router strips query params)
          try {
            const frame = e.currentTarget as HTMLIFrameElement;
            frame.contentWindow?.sessionStorage?.setItem('fg_desktop', '1');
          } catch (_) { /* cross-origin guard */ }
        }}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-top-navigation allow-modals"
      />
    </div>
  );
}
