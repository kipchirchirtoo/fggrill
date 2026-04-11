import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sports Bar',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}