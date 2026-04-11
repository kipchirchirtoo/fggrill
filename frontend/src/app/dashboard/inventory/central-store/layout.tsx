import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Central Store Inventory',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}