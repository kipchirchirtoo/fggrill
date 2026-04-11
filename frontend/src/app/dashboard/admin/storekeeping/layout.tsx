import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storekeeping',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}