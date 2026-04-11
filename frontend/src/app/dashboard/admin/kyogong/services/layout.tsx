import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kyogong Services',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}