import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Behavior Intelligence',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}