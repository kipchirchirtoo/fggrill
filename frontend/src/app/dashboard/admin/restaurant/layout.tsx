import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Restaurant',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}