import type { Metadata } from 'next'
import { Playfair_Display, Lato } from 'next/font/google'
import Script from 'next/script'
import { Providers } from '@/components/Providers'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/globals.css'
import { hotelSchema, restaurantSchema, organizationSchema, faqSchema } from '@/lib/seo/schemas'

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  preload: true
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-body',
  preload: true
})

export const metadata: Metadata = {
  metadataBase: new URL('https://famousgates.com'),

  title: {
    default: 'Famous Gates Hotels | Luxury Hotel in Nairobi, Kenya',
    template: '%s | Famous Gates Hotels'
  },

  description:
    'Famous Gates Hotels — Nairobi\'s premier luxury hotel. Elegant rooms, ' +
    'fine dining at FG Grill, conference facilities, and exceptional service. ' +
    'Book direct for the best rates. Call us today.',

  keywords: [
    'Famous Gates Hotels',
    'Famous Gates',
    'FG Hotels',
    'FG Grill',
    'FG Grill Nairobi',
    'FG hotel',
    'hotel Nairobi',
    'luxury hotel Nairobi',
    'luxury hotel Nairobi Kenya',
    'best hotel Nairobi',
    'hotel near CBD Nairobi',
    'conference hotel Nairobi',
    'restaurant Nairobi',
    'fine dining Nairobi',
    'grill restaurant Nairobi',
    'accommodation Nairobi',
    'hotel booking Nairobi',
    'Famous Gates restaurant',
    'FG conference center',
    'FG banquet hall Nairobi'
  ],

  authors: [{ name: 'Famous Gates Hotels', url: 'https://famousgates.com' }],
  creator: 'Famous Gates Hotels',
  publisher: 'Famous Gates Hotels',

  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },

  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://famousgates.com',
    siteName: 'Famous Gates Hotels',
    title: 'Famous Gates Hotels | Luxury Hotel in Nairobi, Kenya',
    description:
      'Experience Nairobi\'s finest hospitality at Famous Gates Hotels. ' +
      'Luxury rooms, FG Grill restaurant, conference & banquet facilities. ' +
      'Book direct and save.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Famous Gates Hotels — Luxury Hotel in Nairobi, Kenya',
        type: 'image/jpeg'
      }
    ]
  },

  twitter: {
    card: 'summary_large_image',
    site: '@famousgateshotel',
    creator: '@famousgateshotel',
    title: 'Famous Gates Hotels | Luxury Hotel in Nairobi',
    description:
      'Nairobi\'s premier hotel. Luxury rooms, FG Grill restaurant, ' +
      'conference facilities. Book direct for best rates.',
    images: ['/og-image.jpg']
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },

  verification: {
    google: 'REPLACE_WITH_GSC_VERIFICATION_TOKEN'
  },

  alternates: {
    canonical: 'https://famousgates.com'
  },

  manifest: '/manifest.json',
  category: 'Hotel',

  other: {
    'geo.region': 'KE-30',
    'geo.placename': 'Nairobi',
    'geo.position': '-1.2921;36.8219',
    'ICBM': '-1.2921, 36.8219'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${lato.variable}`}>
      <head>
        <Script
          id="schema-hotel"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelSchema) }}
          strategy="beforeInteractive"
        />
        <Script
          id="schema-restaurant"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
          strategy="beforeInteractive"
        />
        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
          strategy="beforeInteractive"
        />
        <Script
          id="schema-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          strategy="beforeInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XZSYKGF1Q5"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XZSYKGF1Q5', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
