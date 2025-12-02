'use client';

import { StorekeepingLayout } from '@/components/layout/StorekeepingLayout';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StorekeepingLayout>{children}</StorekeepingLayout>;
}
