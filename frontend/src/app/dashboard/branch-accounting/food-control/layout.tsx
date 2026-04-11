import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Food Control',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}