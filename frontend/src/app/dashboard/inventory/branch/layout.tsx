import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Branch Inventory',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}