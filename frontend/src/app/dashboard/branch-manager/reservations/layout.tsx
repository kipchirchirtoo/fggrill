import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reservations',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}