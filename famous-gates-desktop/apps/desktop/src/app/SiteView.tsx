import React from 'react';

/**
 * SiteView — Direct full-screen portal to the Famous Gates website.
 * No local shell, no internal auth, no loaders.
 * Opens the terminal path specifically for POS utility.
 */
export function SiteView() {
  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      <iframe
        src="https://famousgate.hirall.com/terminal?fg_desktop=1"
        className="h-full w-full border-0"
        title="Famous Gates Hotels"
        allow="fullscreen clipboard-read clipboard-write"
      />
    </div>
  );
}
