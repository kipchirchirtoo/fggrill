import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'FG Grill Menu | Famous Gates Hotels Nairobi Restaurant',
  description:
    'Explore the FG Grill menu. Signature grills, Kenyan specialties, ' +
    'continental dishes, and fine wines. Best restaurant menu in Nairobi. ' +
    'Breakfast, lunch, and dinner options available.',
  alternates: { canonical: 'https://famousgates.com/restaurant/menu' }
}

const menuSections = [
  {
    title: 'Signature Grills',
    items: [
      { name: 'Famous Gates Mixed Grill', price: 'KES 2,500', desc: 'A combination of lamb chops, beef fillet, and chicken wings served with chips.' },
      { name: 'T-Bone Steak', price: 'KES 1,800', desc: 'Prime Kenyan beef grilled to perfection.' },
    ]
  },
  {
    title: 'Kenyan Specialties',
    items: [
      { name: 'Whole Tilapia', price: 'KES 1,500', desc: 'Fresh lake fish served with ugali and sukuma wiki.' },
      { name: 'Nyama Choma', price: 'KES 1,200', desc: 'Slow roasted goat meat served with kachumbari.' },
    ]
  }
];

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />
      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Restaurant', href: '/restaurant' },
          { label: 'Menu', href: '/restaurant/menu' }
        ]} />
      </div>

      <section className="py-20">
        <div className="lp-container">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-neutral-900 mb-12 text-center">
              FG Grill <em className="text-gold italic">Menu</em>
            </h1>

            <div className="space-y-16">
              {menuSections.map((section, idx) => (
                <div key={idx}>
                  <h2 className="text-3xl font-display font-bold text-gold border-b border-gold/20 pb-4 mb-8">
                    {section.title}
                  </h2>
                  <div className="space-y-8">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-neutral-900">{item.name}</h3>
                          <p className="text-neutral-600 mt-1">{item.desc}</p>
                        </div>
                        <span className="text-xl font-display font-bold text-primary-600">{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-20 p-8 bg-neutral-900 text-white rounded-2xl text-center">
              <h3 className="text-2xl font-display font-bold mb-4">Book Your Table</h3>
              <p className="mb-8 opacity-80">Join us for an unforgettable culinary journey at FG Grill.</p>
              <a href="/contact" className="lp-btn lp-btn--gold">Reserve Now</a>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
