'use client';

import { Header, Footer } from '@/components/layout';
import { HotelList } from '@/components/hotel';
import { useBranches } from '@/hooks/useHotels';
import { Hotel } from '@/types';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function RoomsClient() {
  const { data: branches, isLoading, error } = useBranches();

  const hotels: Hotel[] = (branches || [])
    .filter((branch: any) => branch.status === 'active' || branch.status === true)
    .map((branch: any) => ({
      id: branch.id.toString(),
      name: branch.name,
      location: branch.location,
      description: `Experience luxury rooms at ${branch.name}. All rooms feature premium bedding, high-speed WiFi, and 24-hour room service.`,
      shortDescription: `Luxury stay in ${branch.location}`,
      primaryImage: '/rooms-bg.jpg',
      images: ['/rooms-bg.jpg', '/dining-bg.jpg', '/events-bg.jpg'],
      amenities: [
        'Free WiFi',
        'Restaurant & Bar',
        'Room Service',
        'Conference Facilities',
        'Parking',
        'Air Conditioning',
      ],
      contactInfo: {
        phone: branch.phone || '0706782828',
        email: branch.email || 'famousgatesbmt@gmail.com',
        address: branch.address,
        businessHours: '24/7',
        socialMedia: {
          facebook: 'https://facebook.com/famousgate',
          instagram: 'https://instagram.com/famousgate',
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  return (
    <main className="min-h-screen bg-neutral-50">
      <Header />
      
      <div className="lp-container">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Rooms', href: '/rooms' }
        ]} />
      </div>

      <section className="bg-gradient-to-b from-primary-50 to-white py-16 md:py-24">
        <div className="lp-container">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-primary-600 font-medium mb-4 tracking-wide uppercase text-sm">
              Luxury Accommodations
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-neutral-900 mb-6">
              Our <em className="text-primary-600 italic">Rooms & Suites</em>
            </h1>
            <div className="w-24 h-1 bg-primary-500 mx-auto mb-6" />
            <p className="text-lg text-neutral-600 leading-relaxed">
              Explore our range of elegantly appointed rooms. From standard rooms for business
              travelers to executive suites for ultimate luxury, we have the perfect stay for you.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="lp-container">
          <HotelList hotels={hotels} isLoading={isLoading} error={error || null} />
        </div>
      </section>

      <section className="bg-primary-600 py-16 md:py-20">
        <div className="lp-container">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
              Ready to Book Your <em className="italic">Stay?</em>
            </h2>
            <Link
              href="/book"
              className="inline-block px-8 py-4 bg-white text-primary-600 font-semibold rounded-md hover:bg-primary-50 transition-colors duration-300"
            >
              Book Direct for Best Rates
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
