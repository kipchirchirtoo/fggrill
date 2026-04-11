import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Booking Confirmation',
}

export default function ConfirmationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
