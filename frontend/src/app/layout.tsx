import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import { Providers } from "@/components/providers"
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Famous Gate Hotel Management System",
  description: "Professional hotel management system for Famous Gate Hotel in Kericho, Kenya",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Providers>
            {children}
            <Toaster position="top-right" />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  )
}
