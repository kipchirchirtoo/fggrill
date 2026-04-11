import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Financial Verification',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}