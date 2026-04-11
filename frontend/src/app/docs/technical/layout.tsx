import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Technical',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}