import Head from 'next/head';
import { Header, Footer } from '@/components/layout';
import { HotelList } from '@/components/hotel';
import { useBranches } from '@/hooks/useHotels';
import { Hotel } from '@/types';

import Link from 'next/link';

/**
 * Hotels Page
 * Displays all FamousGate Hotels properties in a grid layout
 * Requirements: 1.1, 1.3, 1.5, 7.5
 */
export default function HotelsPage() {
  const { data: branches, isLoading, error } = useBranches();

  // Transform branches to Hotel format
  const hotels: Hotel[] = (branches || [])
    .filter((branch: any) => branch.status === 'active' || branch.status === true)
    .map((branch: any) => ({
      id: branch.id.toString(),
      name: branch.name,
      location: branch.location,
      description: `Experience luxury and comfort at ${branch.name}. Located in ${branch.location}, we offer world-class amenities and exceptional service.`,
      shortDescription: `Premium hospitality in ${branch.location}`,
      primaryImage: '/rooms-bg.jpg', // Default image, can be customized per branch
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
    <>
      <Head>
        <title>Our Hotels — FamousGate Hotels</title>
        <meta
          name="description"
          content="Discover all FamousGate Hotels locations. Premium accommodations, world-class dining, and exceptional service across multiple destinations."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="min-h-screen bg-neutral-50">
        {/* Page Header */}
        <section className="bg-gradient-to-b from-primary-50 to-white py-16 md:py-24">
          <div className="lp-container">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-primary-600 font-medium mb-4 tracking-wide uppercase text-sm">
                Our Locations
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-neutral-900 mb-6">
                Discover Our <em className="text-primary-600 italic">Hotels</em>
              </h1>
              <div className="w-24 h-1 bg-primary-500 mx-auto mb-6" />
              <p className="text-lg text-neutral-600 leading-relaxed">
                From urban sanctuaries to serene escapes, FamousGate Hotels offers premium
                hospitality across multiple locations. Each property is designed to provide
                exceptional comfort and unforgettable experiences.
              </p>
            </div>
          </div>
        </section>

        {/* Hotels Grid */}
        <section className="py-16 md:py-20">
          <div className="lp-container">
            <HotelList hotels={hotels} isLoading={isLoading} error={error || null} />
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-primary-600 py-16 md:py-20">
          <div className="lp-container">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
                Ready to Experience <em className="italic">Luxury?</em>
              </h2>
              <p className="text-primary-100 text-lg mb-8">
                Book your stay today and discover why guests choose FamousGate Hotels for
                their most memorable occasions.
              </p>
              <Link
                href="/#reservations"
                className="inline-block px-8 py-4 bg-white text-primary-600 font-semibold rounded-md hover:bg-primary-50 transition-colors duration-300"
              >
                Book Your Stay
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
