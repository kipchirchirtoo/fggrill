import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bar POS',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}