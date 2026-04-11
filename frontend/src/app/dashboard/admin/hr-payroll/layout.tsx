import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HR & Payroll',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}