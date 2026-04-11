import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sold Items',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}