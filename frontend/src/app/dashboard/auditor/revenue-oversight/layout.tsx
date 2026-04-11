import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Revenue Oversight',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}