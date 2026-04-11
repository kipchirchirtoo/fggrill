import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'POS & Kitchen',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}