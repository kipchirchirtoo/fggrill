import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reception Role',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}