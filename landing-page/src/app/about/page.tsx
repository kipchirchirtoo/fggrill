import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'About Us | Famous Gates Hotels Nairobi',
  description:
    'Discover the story of Famous Gates Hotels - Nairobi\'s premier luxury hospitality brand. ' +
    'Our commitment to excellence, heritage, and world-class service redefined.',
  alternates: { canonical: 'https://famousgates.com/about' },
  openGraph: {
    title: 'About Us | Famous Gates Hotels Nairobi',
    url: 'https://famousgates.com/about',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }]
  }
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />

      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' }
        ]} />
      </div>

      <section className="py-20">
        <div className="lp-container">
          <div className="max-w-4xl mx-auto text-center mb-20">
            <h1 className="text-5xl md:text-6xl font-display font-bold text-neutral-900 mb-8 leading-tight">
              A Legacy of <em className="text-gold italic">Exceptional Hospitality</em>
            </h1>
            <div className="w-24 h-1 bg-gold mx-auto mb-8" />
            <p className="text-xl text-neutral-600 leading-relaxed">
              At Famous Gates Hotels, we believe that luxury is not just about the surroundings, but about the feelings of comfort, belonging, and being truly cared for.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
            <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
              <Image src="/hero-bg.jpg" alt="Famous Gates Hotels heritage" fill className="object-cover" />
            </div>
            <div>
              <h2 className="text-3xl font-display font-bold mb-6 text-neutral-900">Our Story</h2>
              <p className="text-lg text-neutral-600 leading-relaxed mb-6">
                Founded with a vision to redefine the hospitality landscape in Nairobi, Famous Gates Hotels has grown into a beacon of luxury and refinement. Our journey began over 15 years ago with a single property and a promise: to provide a sanctuary for travelers seeking the very best in Kenyan hospitality.
              </p>
              <p className="text-lg text-neutral-600 leading-relaxed">
                Today, Famous Gates is synonymous with elegance, from the architectural design of our buildings to the meticulously crafted menus at FG Grill. We continue to evolve, integrating modern technology and sustainable practices while never losing sight of our core values: service, integrity, and excellence.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-2xl shadow-lg text-center">
              <div className="text-gold text-4xl mb-4">💎</div>
              <h3 className="text-xl font-bold mb-4">Our Values</h3>
              <p className="text-neutral-600">Integrity and excellence in every interaction, ensuring a premium experience for every guest.</p>
            </div>
            <div className="bg-white p-10 rounded-2xl shadow-lg text-center">
              <div className="text-gold text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-4">Our Mission</h3>
              <p className="text-neutral-600">To provide a sanctuary of comfort and elegance that exceeds the expectations of our refined guests.</p>
            </div>
            <div className="bg-white p-10 rounded-2xl shadow-lg text-center">
              <div className="text-gold text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-bold mb-4">Our Vision</h3>
              <p className="text-neutral-600">To be the most recognized and respected luxury hospitality brand in East Africa.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
