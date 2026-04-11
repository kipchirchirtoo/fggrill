import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payroll Approvals',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}