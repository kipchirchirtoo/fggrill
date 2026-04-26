import type { Metadata } from 'next'
import { Header, Footer } from '@/components/layout'
import { Breadcrumb } from '@/components/Breadcrumb'

export const metadata: Metadata = {
  title: 'Book Your Stay | Famous Gates Hotels Nairobi Online Reservation',
  description:
    'Book your room at Famous Gates Hotels, Nairobi direct for the best ' +
    'available rates. Easy online reservation for luxury rooms and suites. ' +
    'Experience infinite comfort and world-class service.',
  alternates: { canonical: 'https://famousgates.com/book' }
}

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />
      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Book Now', href: '/book' }
        ]} />
      </div>

      <section className="py-20">
        <div className="lp-container max-w-4xl">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100">
            <div className="bg-neutral-900 text-white p-12 text-center">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                Secure Your <em className="text-gold italic">Stay</em>
              </h1>
              <p className="text-neutral-400 max-w-xl mx-auto">
                Reserve your luxury experience at Famous Gates Hotels Nairobi. 
                Direct bookings guarantee the lowest prices and exclusive perks.
              </p>
            </div>
            
            <div className="p-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <h3 className="text-xl font-bold mb-2">Instant Confirmation</h3>
                  <p className="text-neutral-600">Receive your booking details immediately via email and SMS.</p>
                </div>
                <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <h3 className="text-xl font-bold mb-2">Flexible Cancellation</h3>
                  <p className="text-neutral-600">Enjoy peace of mind with our flexible cancellation policies.</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-neutral-500 mb-8 italic">
                  Our online booking system is currently being optimized for your experience. 
                  Please contact our reservations desk directly for immediate assistance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href="tel:+254706782828" className="lp-btn lp-btn--primary">Call Reservations</a>
                  <a href="mailto:info@famousgates.com" className="lp-btn lp-btn--outline">Email Inquiry</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
