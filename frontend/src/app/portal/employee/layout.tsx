import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Employee Portal',
}

export default function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
