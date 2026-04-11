import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Channel Manager',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
