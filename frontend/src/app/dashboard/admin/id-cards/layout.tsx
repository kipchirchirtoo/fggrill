import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ID Cards',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}