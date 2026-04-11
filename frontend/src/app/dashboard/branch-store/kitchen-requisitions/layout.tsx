import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kitchen Requisitions',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}