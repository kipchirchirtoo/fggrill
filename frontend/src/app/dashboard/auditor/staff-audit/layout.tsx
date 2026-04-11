import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff Audit',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}