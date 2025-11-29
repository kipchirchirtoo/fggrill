'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to branch-manager reservations
export default function ManagerReservationsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/dashboard/branch-manager/reservations');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting...</p>
    </div>
  );
}
