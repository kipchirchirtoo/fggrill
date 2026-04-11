import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shift Review',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}