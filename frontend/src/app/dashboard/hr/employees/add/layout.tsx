import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Add Employee',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}