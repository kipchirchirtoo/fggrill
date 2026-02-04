import "./globals.css"
import "./ios-theme.css"
import { Providers } from "@/components/providers"
import { AuthProvider } from '@/lib/auth-context'

export const metadata = {
  title: "Famous Gate Hotel Management System",
  description: "Professional hotel management system for Famous Gate Hotel in Kericho, Kenya",
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
