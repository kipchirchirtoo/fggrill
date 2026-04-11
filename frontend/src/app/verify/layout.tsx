import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ID Verification',
}

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
