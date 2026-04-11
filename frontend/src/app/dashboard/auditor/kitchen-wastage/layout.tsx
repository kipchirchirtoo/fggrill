import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kitchen Wastage',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}