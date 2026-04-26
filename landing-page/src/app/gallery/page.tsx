import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import GalleryClient from '@/components/gallery/GalleryClient'

export const metadata: Metadata = {
  title: 'Photo Gallery | Famous Gates Hotels Nairobi',
  description:
    'View photos of Famous Gates Hotels, Nairobi. Luxury rooms, FG Grill ' +
    'restaurant, conference halls, and event spaces. Experience the beauty of our property.',
  alternates: { canonical: 'https://famousgates.com/gallery' }
}

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />
      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Gallery', href: '/gallery' }
        ]} />
      </div>
      <section className="py-20">
        <div className="lp-container">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-neutral-900 mb-12 text-center">
            Our <em className="text-gold italic">Gallery</em>
          </h1>
          <GalleryClient />
        </div>
      </section>
      <Footer />
    </main>
  )
}
