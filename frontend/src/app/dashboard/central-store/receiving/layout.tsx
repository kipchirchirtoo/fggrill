import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Receiving',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}