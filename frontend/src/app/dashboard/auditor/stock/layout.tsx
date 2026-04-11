import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stock',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}