import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Supplier Reports',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}