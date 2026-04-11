import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Packing',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}