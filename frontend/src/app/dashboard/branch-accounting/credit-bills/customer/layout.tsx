import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Credit',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}