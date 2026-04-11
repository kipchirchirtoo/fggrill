import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
