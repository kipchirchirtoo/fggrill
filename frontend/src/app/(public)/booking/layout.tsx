import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complete Booking',
}

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
