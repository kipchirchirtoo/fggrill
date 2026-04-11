import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lost & Found',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}