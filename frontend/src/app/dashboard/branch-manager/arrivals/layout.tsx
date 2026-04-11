import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Arrivals',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}