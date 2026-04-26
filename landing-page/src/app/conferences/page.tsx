import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Conference & Event Facilities | Famous Gates Hotels Nairobi',
  description:
    'World-class conference and banquet facilities at Famous Gates Hotels, Nairobi. ' +
    'Fully equipped meeting rooms, corporate events, seminars, and private functions. ' +
    'AV equipment, catering, and dedicated event staff included.',
  alternates: { canonical: 'https://famousgates.com/conferences' },
  openGraph: {
    title: 'Conference Facilities | Famous Gates Hotels Nairobi',
    url: 'https://famousgates.com/conferences',
    images: [{ url: '/images/conference-og.jpg', width: 1200, height: 630 }]
  }
}

export default function ConferencesPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />

      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Conferences', href: '/conferences' }
        ]} />
      </div>

      {/* Hero Section */}
      <section className="relative h-[50vh] flex items-center justify-center text-center text-white">
        <Image
          src="/events-bg.jpg"
          alt="Conference room facilities at Famous Gates Hotels Nairobi"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 lp-container">
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-4 tracking-tight">
            Conferences & <em className="text-gold italic">Corporate Events</em>
          </h1>
          <p className="text-xl max-w-2xl mx-auto opacity-90">
            Elevate your business meetings with world-class facilities in the heart of Nairobi.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-20">
        <div className="lp-container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-gold uppercase tracking-widest font-medium mb-4">Professional Excellence</p>
              <h2 className="text-4xl font-display font-bold text-neutral-900 mb-6">Designed for Productive Conversations</h2>
              <div className="w-24 h-1 bg-gold mx-auto" />
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-20">
              <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-gold">
                <div className="text-4xl mb-4">🎤</div>
                <h3 className="text-2xl font-display font-bold mb-4">Main Ballroom</h3>
                <p className="text-neutral-600 mb-6">Our grand ballroom is perfect for large conferences, gala dinners, and corporate product launches, accommodating up to 500 guests in a variety of setups.</p>
                <ul className="space-y-2 text-neutral-700">
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> High-end AV systems</li>
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> Stage & lighting setup</li>
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> Flexible partitions</li>
                </ul>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-gold">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="text-2xl font-display font-bold mb-4">Executive Boardrooms</h3>
                <p className="text-neutral-600 mb-6">For smaller, more focused discussions, our executive boardrooms provide a private and professional atmosphere with all the modern amenities you need.</p>
                <ul className="space-y-2 text-neutral-700">
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> Ergonomic seating</li>
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> Video conferencing</li>
                  <li className="flex items-center gap-2"><span className="text-gold">✦</span> Dedicated business center</li>
                </ul>
              </div>
            </div>

            <div className="bg-white p-12 rounded-2xl shadow-xl overflow-hidden relative">
              <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h3 className="text-3xl font-display font-bold mb-6">Bespoke Catering</h3>
                  <p className="text-neutral-600 mb-6">Our culinary team at FG Grill provides dedicated catering for all events, from morning coffee breaks to elaborate multi-course banquets.</p>
                  <a href="/restaurant" className="text-gold font-bold hover:underline">Explore FG Grill Catering &rarr;</a>
                </div>
                <div className="relative h-64 rounded-lg overflow-hidden">
                  <Image src="/dining-bg.jpg" alt="Event catering at Famous Gates Hotels" fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600 text-white text-center">
        <div className="lp-container">
          <h2 className="text-4xl font-display font-bold mb-6">Plan Your Next Event With Us</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">Contact our dedicated event planners to receive a customized proposal for your upcoming function.</p>
          <div className="flex justify-center gap-6">
            <a href="/contact" className="lp-btn lp-btn--gold">Get a Quote</a>
            <a href="tel:+254706782828" className="lp-btn lp-btn--outline text-white border-white">Call Events Team</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
