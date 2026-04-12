import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Management',
}

export default function LeaveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children;
}
