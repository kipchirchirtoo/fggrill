import React, { useState, useEffect } from 'react';

/**
 * SiteView — Direct full-screen portal to the Famous Gates website.
 * No local shell, no internal auth, no loaders.
 * Opens the terminal path specifically for POS utility.
 * 
 * v1.0.5 - Fixed connection error handling
 */

const SITE_URL = import.meta.env.VITE_WEB_URL || 'https://famousgate.hirall.com';
const TERMINAL_PATH = '/terminal?fg_desktop=1';

export function SiteView() {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if site is reachable before loading iframe
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(SITE_URL, { 
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        setIsLoading(false);
      } catch {
        // Connection failed - show error UI
        setError('Connection failed');
        setIsLoading(false);
      }
    };

    checkConnection();
  }, [retryCount]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(c => c + 1);
  };

  const handleOfflineMode = () => {
    // Navigate to offline mode
    window.location.href = '/offline';
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Famous Gates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h2>
          <p className="text-gray-600 mb-6">
            Unable to connect to <strong>famousgate.hirall.com</strong>.<br/>
            This could be due to:
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-1">
            <li>• No internet connection</li>
            <li>• Server temporarily down</li>
            <li>• Firewall blocking the connection</li>
          </ul>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={handleOfflineMode}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Continue Offline
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Desktop App v1.0.5
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      <iframe
        src={`${SITE_URL}${TERMINAL_PATH}`}
        className="h-full w-full border-0"
        title="Famous Gates Hotels"
        allow="fullscreen clipboard-read clipboard-write"
        onError={() => setError('iframe failed to load')}
      />
    </div>
  );
}
