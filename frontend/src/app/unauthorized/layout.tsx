import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Access Denied',
}

export default function UnauthorizedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
