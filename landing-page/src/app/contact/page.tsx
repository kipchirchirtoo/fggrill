import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'

export const metadata: Metadata = {
  title: 'Contact Us | Famous Gates Hotels Nairobi',
  description:
    'Contact Famous Gates Hotels in Nairobi. Call +254-706-782828, email ' +
    'info@famousgates.com, or visit us at Famous Gates Building, Ngong Road. Reservations, ' +
    'events, and corporate bookings. We respond within 2 hours.',
  alternates: { canonical: 'https://famousgates.com/contact' }
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />

      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Contact', href: '/contact' }
        ]} />
      </div>

      <section className="py-16 md:py-24">
        <div className="lp-container">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-neutral-900 mb-12 text-center">
            Contact <em className="text-gold italic">Famous Gates Hotels</em>
          </h1>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* Contact Details */}
            <div className="space-y-12">
              <div>
                <h2 className="text-2xl font-display font-bold mb-6 text-neutral-900">Get in Touch</h2>
                <address className="not-italic space-y-4 text-lg text-neutral-600" itemScope itemType="https://schema.org/Hotel">
                  <div className="flex items-start gap-4">
                    <span className="text-gold">📍</span>
                    <div>
                      <span itemProp="name" className="font-bold text-neutral-900 block mb-1">Famous Gates Hotels</span>
                      <span itemProp="streetAddress">Famous Gates Building, Ngong Road</span><br />
                      <span itemProp="addressLocality">Nairobi</span>,{' '}
                      <span itemProp="addressCountry">Kenya</span>{' '}
                      <span itemProp="postalCode">00100</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gold">📞</span>
                    <a href="tel:+254706782828" itemProp="telephone" className="hover:text-gold transition-colors">+254 706 782 828</a>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gold">✉️</span>
                    <a href="mailto:info@famousgates.com" itemProp="email" className="hover:text-gold transition-colors">info@famousgates.com</a>
                  </div>
                </address>
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold mb-6 text-neutral-900">Operating Hours</h2>
                <div className="space-y-4 text-neutral-600">
                  <div>
                    <h3 className="font-bold text-neutral-900">Hotel Reception</h3>
                    <p>Open 24 hours, 7 days a week</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900">FG Grill Restaurant</h3>
                    <p>Monday – Friday: 7:00 AM – 10:00 PM</p>
                    <p>Saturday – Sunday: 7:00 AM – 11:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Map */}
            <div className="h-[400px] lg:h-full min-h-[400px] rounded-2xl overflow-hidden shadow-xl border border-neutral-200">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15955.1583091726!2d36.817223!3d-1.286389!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f10d0a424e4d9%3A0x6b638b97d8114f04!2sNairobi%2C%20Kenya!5e0!3m2!1sen!2ske!4v1700000000000!5m2!1sen!2ske"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Famous Gates Hotels location on Google Maps"
                aria-label="Map showing Famous Gates Hotels location in Nairobi Kenya"
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
