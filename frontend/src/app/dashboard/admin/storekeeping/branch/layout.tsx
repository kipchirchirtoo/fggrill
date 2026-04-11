import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Branch Store',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}