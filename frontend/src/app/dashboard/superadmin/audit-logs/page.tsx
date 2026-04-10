'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect from old audit-logs route to new Security Center
 * This maintains backward compatibility while consolidating security features
 */
export default function AuditLogsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new Security Center
    router.replace('/dashboard/super/admin/security');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Security Center...</p>
      </div>
    </div>
  );
}
