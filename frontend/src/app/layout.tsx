import "./globals.css"
import "./ios-theme.css"
import { Providers } from "@/components/providers"
import { AuthProvider } from '@/lib/auth-context'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | FamousGates Hotels',
    default: 'FamousGates Hotels',
  },
  description: 'Ultra-Premium Hospitality Management Architecture by Hirall Systems',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
      </head>
      <body className="light" suppressHydrationWarning>
        <AuthProvider>
          <Providers>
            {children}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  )
}
