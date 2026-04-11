import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payroll',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}