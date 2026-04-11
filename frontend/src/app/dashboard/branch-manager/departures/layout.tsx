import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Departures',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}