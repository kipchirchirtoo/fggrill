import "./globals.css"
import "./ios-theme.css"
import { Providers } from "@/components/providers"
import { AuthProvider } from '@/lib/auth-context'

export const metadata = {
  title: "Kyogong Management System",
  description: "Professional hotel management system for Kyogong in Kericho, Kenya",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <Providers>
            {children}
            {/* Toaster is now included in the Providers component */}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  )
}
