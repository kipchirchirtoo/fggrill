import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Business M-Pesa',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}