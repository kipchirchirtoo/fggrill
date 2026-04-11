import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Credit Bills',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}