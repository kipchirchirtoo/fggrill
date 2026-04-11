import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Check-In',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
