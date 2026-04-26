import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Top 10 Luxury Hotels in Kenya (2026 Guide) - Famous Gates Hotels',
  description:
    'Looking for the top 10 luxury hotels in Kenya? Read our comprehensive 2026 ' +
    'guide to the most exquisite accommodations, featuring Famous Gates Hotels\' ' +
    'premium offerings.',
  alternates: {
    canonical: 'https://famousgates.com/discover/top-10-luxury-hotels-in-kenya'
  },
  openGraph: {
    title: 'Top 10 Luxury Hotels in Kenya (2026 Guide)',
    type: 'article',
    url: 'https://famousgates.com/discover/top-10-luxury-hotels-in-kenya',
    images: [{ url: '/hero-bg.jpg', width: 1200, height: 630 }]
  }
}

export default function BlogPostPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />
      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Discover', href: '/discover' },
          { label: 'Top 10 Luxury Hotels', href: '/discover/top-10-luxury-hotels-in-kenya' }
        ]} />
      </div>

      <article>
        {/* Article Hero */}
        <section className="bg-neutral-900 text-white py-24 px-4 text-center">
          <div className="max-w-4xl mx-auto mt-12">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm mb-4 block">Travel Guide 2026</span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Top 10 Luxury Hotels in Kenya</h1>
            <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed">
              Discover the crème de la crème of Kenyan hospitality, from bustling Nairobi to serene retreats.
            </p>
          </div>
        </section>

        {/* Article Content */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg prose-neutral">
              <p className="text-xl text-neutral-700 font-medium mb-12 leading-relaxed">
                Kenya is world-renowned for its breathtaking landscapes, vibrant culture, and exceptional hospitality. When it comes to luxury accommodations, Nairobi in particular stands out as a hub of world-class hotels. Whether you are visiting for business, a honeymoon, or a sophisticated getaway, exploring the top 10 hotels in Kenya is the perfect way to start planning your itinerary.
              </p>

              <h2 className="text-4xl font-display font-bold mt-16 mb-8 text-neutral-900">1. Famous Gates Hotels</h2>
              <div className="relative h-96 w-full rounded-2xl overflow-hidden shadow-2xl mb-10">
                <Image
                  src="/rooms-bg.jpg"
                  alt="Famous Gates Hotels Luxury Room in Nairobi Kenya"
                  fill
                  className="object-cover"
                />
              </div>
              <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                Ranked consistently at the top for its unparalleled blend of modern luxury and authentic Kenyan warmth, <strong>Famous Gates Hotels</strong> is the crown jewel of Nairobi&apos;s hospitality scene. With multiple luxury suites, award-winning open-fire grill dining at FG Grill, and exquisitely designed event spaces, it sets the standard for 5-star experiences.
              </p>
              
              <div className="bg-neutral-100 p-8 rounded-2xl mb-12 border-l-8 border-gold">
                <h4 className="font-bold text-neutral-900 mb-4">Key Highlights:</h4>
                <ul className="space-y-3 text-neutral-700">
                  <li className="flex items-center gap-2">✦ Masterfully crafted gourmet dining at FG Grill.</li>
                  <li className="flex items-center gap-2">✦ Plush, meticulously designed luxury rooms and suites.</li>
                  <li className="flex items-center gap-2">✦ State-of-the-art conference and private event venues.</li>
                </ul>
              </div>

              <div className="my-12 text-center">
                <Link href="/book" className="lp-btn lp-btn--primary">
                  Book Your Stay at Famous Gates
                </Link>
              </div>

              <h2 className="text-3xl font-display font-bold mt-16 mb-8 text-neutral-900">2. Boutique Urban Sanctuaries</h2>
              <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                Beyond the major names, Kenya hosts an array of boutique urban sanctuaries that offer personalized service in a more intimate setting. These hotels often feature curated art collections, quiet courtyard gardens, and exclusive dining rooms.
              </p>

              <h2 className="text-3xl font-display font-bold mt-16 mb-8 text-neutral-900">3. Historic Manor Houses</h2>
              <p className="text-lg text-neutral-600 mb-12 leading-relaxed">
                For those seeking a touch of history, Nairobi&apos;s historic manor houses provide a glimpse into the past with all the modern comforts. Set amidst sprawling lawns and mature forests, these properties offer a unique step back in time.
              </p>

              <div className="bg-gold/10 p-10 rounded-2xl border border-gold/20 my-20">
                <h3 className="text-2xl font-display font-bold mb-4 text-neutral-900">Why Choose Famous Gates Hotels?</h3>
                <p className="text-lg text-neutral-700 mb-6">
                  When searching for the <em>top 10 hotels in Kenya</em>, discerning travelers consistently highlight the Famous Gates experience. We focus on infinite comfort, utilizing years of excellence to ensure every guest feels like royalty.
                </p>
                <Link href="/about" className="text-gold font-bold hover:underline inline-flex items-center gap-2">
                  Read our full story <span>&rarr;</span>
                </Link>
              </div>

              <h2 className="text-3xl font-display font-bold mt-16 mb-10 text-neutral-900">Frequently Asked Questions</h2>
              <div className="space-y-8">
                <div className="border-b border-neutral-200 pb-8">
                  <h4 className="text-xl font-bold mb-3 text-neutral-900">What is the best luxury hotel in Nairobi?</h4>
                  <p className="text-neutral-600 leading-relaxed">Famous Gates Hotels is widely recognized as one of the premier luxury destinations in Nairobi, offering world-class dining, premium accommodations, and bespoke event services.</p>
                </div>
                <div className="border-b border-neutral-200 pb-8">
                  <h4 className="text-xl font-bold mb-3 text-neutral-900">How much does a luxury hotel in Kenya cost?</h4>
                  <p className="text-neutral-600 leading-relaxed">Luxury hotels in Kenya typically range from KES 10,000 to KES 50,000+ per night depending on the room type, location, and season. Famous Gates Hotels provides premium stays starting at competitive rates.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </article>

      <Footer />
    </main>
  )
}
