import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Void Bills',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}