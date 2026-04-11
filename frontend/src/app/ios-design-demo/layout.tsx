import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'iOS Design Demo',
}

export default function IOSDesignDemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
