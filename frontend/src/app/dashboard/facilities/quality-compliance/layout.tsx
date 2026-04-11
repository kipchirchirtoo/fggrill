import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quality & Compliance',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}