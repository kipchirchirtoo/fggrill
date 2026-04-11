import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bar Menu',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}