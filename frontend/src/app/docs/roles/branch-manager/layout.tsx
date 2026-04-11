import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Branch Manager Role',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}