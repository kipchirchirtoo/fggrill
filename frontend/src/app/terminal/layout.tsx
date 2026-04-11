import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terminal',
}

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
