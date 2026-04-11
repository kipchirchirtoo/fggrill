import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Banking',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}