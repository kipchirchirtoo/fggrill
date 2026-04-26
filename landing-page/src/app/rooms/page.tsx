import type { Metadata } from 'next'
import RoomsClient from '@/components/rooms/RoomsClient'

export const metadata: Metadata = {
  title: 'Rooms & Suites | Famous Gates Hotels Nairobi',
  description:
    'Explore luxurious rooms and suites at Famous Gates Hotels, Nairobi. ' +
    'From standard rooms to executive suites. All rooms include free WiFi, ' +
    'room service, and premium amenities. Book direct from KES 5,000/night.',
  alternates: { canonical: 'https://famousgates.com/rooms' },
  openGraph: {
    title: 'Rooms & Suites | Famous Gates Hotels Nairobi',
    url: 'https://famousgates.com/rooms',
    images: [{ url: '/images/rooms-og.jpg', width: 1200, height: 630 }]
  }
}

export default function RoomsPage() {
  return <RoomsClient />
}
