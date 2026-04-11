import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stock Takes',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}