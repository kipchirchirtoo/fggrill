import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Supplier Invoices',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}