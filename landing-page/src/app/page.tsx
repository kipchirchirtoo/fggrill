import type { Metadata } from 'next'
import HomeClient from '@/components/home/HomeClient'

export const metadata: Metadata = {
  title: 'Famous Gates Hotels | Luxury Hotel in Nairobi, Kenya',
  description:
    'Famous Gates Hotels — Nairobi\'s premier luxury destination. ' +
    'Elegant rooms, FG Grill fine dining, conference facilities. ' +
    'Book direct at the best rate. +254-706-782828',
  alternates: { canonical: 'https://famousgates.com' },
  openGraph: {
    title: 'Famous Gates Hotels | Luxury Hotel in Nairobi, Kenya',
    description: 'Nairobi\'s finest hotel. Book direct at famousgates.com.',
    url: 'https://famousgates.com',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }]
  }
}

export default function HomePage() {
  return <HomeClient />
}
