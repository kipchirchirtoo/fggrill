import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Logbooks',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}