import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Branches',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}