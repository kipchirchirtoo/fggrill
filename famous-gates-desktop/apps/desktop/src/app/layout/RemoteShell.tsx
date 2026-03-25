import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * RemoteShell — A bare full-screen layout for remote web views.
 * No sidebar, no topbar, no padding. The iframe fills the entire window.
 */
export function RemoteShell() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <Outlet />
    </div>
  );
}
