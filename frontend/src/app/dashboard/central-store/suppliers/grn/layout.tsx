import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Supplier GRN',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}