'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BarPOSPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/pos-kitchen?tab=bar');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-stone-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p className="text-stone-600 font-medium">Redirecting to Unified POS...</p>
      </div>
    </div>
  );
}
