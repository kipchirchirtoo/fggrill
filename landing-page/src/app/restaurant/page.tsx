import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'FG Grill Restaurant | Fine Dining at Famous Gates Hotels Nairobi',
  description:
    'FG Grill — signature fine dining restaurant at Famous Gates Hotels, Nairobi. ' +
    'Kenyan cuisine, continental grills, and international dishes. ' +
    'Open 7 days. Table reservations welcome. Best restaurant in Nairobi.',
  alternates: { canonical: 'https://famousgates.com/restaurant' },
  openGraph: {
    title: 'FG Grill Restaurant | Famous Gates Hotels Nairobi',
    url: 'https://famousgates.com/restaurant',
    images: [{ url: '/images/fg-grill-og.jpg', width: 1200, height: 630 }]
  }
}

export default function RestaurantPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />

      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Restaurant', href: '/restaurant' }
        ]} />
      </div>

      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center text-center text-white">
        <Image
          src="/dining-bg.jpg"
          alt="FG Grill fine dining restaurant at Famous Gates Hotels Nairobi"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 lp-container">
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-4 tracking-tight">
            FG Grill — <em className="text-gold italic">Nairobi&apos;s Finest Dining</em>
          </h1>
          <p className="text-xl md:text-2xl max-w-2xl mx-auto opacity-90">
            A celebration of authentic Kenyan flavors and international culinary excellence.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-20">
        <div className="lp-container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-gold uppercase tracking-widest font-medium mb-4">Gourmet Experience</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-8 text-neutral-900 leading-tight">
                Authentic Flavors, <br /><em className="text-primary-600 italic">Masterfully Crafted.</em>
              </h2>
              <div className="w-20 h-1 bg-gold mb-8" />
              <p className="text-lg text-neutral-600 leading-relaxed mb-6">
                FG Grill is the signature restaurant of Famous Gates Hotels, offering a unique blend of Kenyan heritage and global sophistication. Our award-winning chefs specialize in premium grilled cuts, locally sourced seafood, and contemporary African fusion.
              </p>
              <p className="text-lg text-neutral-600 leading-relaxed mb-8">
                Whether you&apos;re joining us for a power lunch, a romantic dinner, or a family celebration, FG Grill provides the perfect ambiance for every occasion.
              </p>
              <div className="flex gap-4">
                <a href="/restaurant/menu" className="lp-btn lp-btn--primary">View Our Menu</a>
                <a href="#reserve" className="lp-btn lp-btn--outline">Reserve a Table</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="relative h-64 rounded-lg overflow-hidden shadow-xl">
                  <Image src="/dining-bg.jpg" alt="Signature dish at FG Grill" fill className="object-cover" />
                </div>
                <div className="relative h-48 rounded-lg overflow-hidden shadow-xl">
                  <Image src="/hero-bg.jpg" alt="Dining ambiance at FG Grill" fill className="object-cover" />
                </div>
              </div>
              <div className="pt-8 space-y-4">
                <div className="relative h-48 rounded-lg overflow-hidden shadow-xl">
                  <Image src="/rooms-bg.jpg" alt="Chef preparing food at FG Grill" fill className="object-cover" />
                </div>
                <div className="relative h-64 rounded-lg overflow-hidden shadow-xl">
                   <Image src="/events-bg.jpg" alt="Elegant table setting at FG Grill" fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Special Sections */}
      <section className="py-20 bg-neutral-900 text-white">
        <div className="lp-container">
           <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="text-gold text-4xl mb-4">🍷</div>
                <h3 className="text-2xl font-display font-bold mb-4">Curated Wine Cellar</h3>
                <p className="text-gray-400">Discover our extensive collection of fine wines from around the world, perfectly paired with your meal.</p>
              </div>
              <div className="text-center">
                <div className="text-gold text-4xl mb-4">🔥</div>
                <h3 className="text-2xl font-display font-bold mb-4">Live Grill Station</h3>
                <p className="text-gray-400">Watch our master chefs prepare premium cuts over traditional charcoal grills for that authentic smokey flavor.</p>
              </div>
              <div className="text-center">
                <div className="text-gold text-4xl mb-4">🌟</div>
                <h3 className="text-2xl font-display font-bold mb-4">Private Dining</h3>
                <p className="text-gray-400">Host your exclusive events in our private dining rooms, complete with dedicated service and customized menus.</p>
              </div>
           </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
