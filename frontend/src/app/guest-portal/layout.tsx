import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guest Portal',
}

export default function GuestPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
