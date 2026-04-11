import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Super Admin',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}