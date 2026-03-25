import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LoginPage — Neutralised local login page.
 * Forces redirect to the root (SiteView iframe).
 */
export function LoginPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white font-sans">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto mb-4" />
        <p className="text-sm font-bold tracking-widest uppercase">Connecting to Famous Gates Hotels...</p>
      </div>
    </div>
  );
}
