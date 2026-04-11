import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff Attendance',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}