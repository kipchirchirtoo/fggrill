import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit Reports',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}