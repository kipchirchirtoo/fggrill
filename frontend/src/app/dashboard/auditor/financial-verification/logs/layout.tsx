import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verification Logs',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}