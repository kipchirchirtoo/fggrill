import { SEO } from '@/components/SEO';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { Header, Footer } from '@/components/layout';
import { HotelList } from '@/components/hotel';
import { useBranches } from '@/hooks/useHotels';
import { Hotel } from '@/types';
import Link from 'next/link';

// ——— Scroll-reveal hook ———
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ——— Reveal Wrapper ———
function Reveal({ children, delay = 0, className = '', style = {} }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function HotelsPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const { data: branches, isLoading, error } = useBranches();

  useEffect(() => {
    setHeroLoaded(true);
  }, []);

  // Transform branches to Hotel format
  const hotels: Hotel[] = (branches || [])
    .filter((branch: any) => branch.status === 'active' || branch.status === true)
    .map((branch: any) => ({
      id: branch.id.toString(),
      name: branch.name,
      location: branch.location,
      description: `Experience luxury and comfort at ${branch.name}. Located in ${branch.location}, we offer world-class amenities and exceptional service.`,
      shortDescription: `Premium hospitality in ${branch.location}`,
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
    <>
      <SEO
        title="Our Hotels & Locations — FamousGate Hotels | Luxury Stay in Bomet"
        description="Bomet Kenya — Discover the premier collection of FamousGate Hotels. From urban sanctuaries to serene escapes, find your perfect luxury stay in Bomet."
        url="https://famousgatehotels.com/hotels"
        breadcrumbs={[
          { name: "Hotels", item: "/hotels" }
        ]}
      />
      <Head>
        <meta name="keywords" content="FamousGate Hotels locations, luxury hotels Bomet, hotel branches Kenya, premium hotels Bomet, boutique hotels Kenya" />
      </Head>

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/rooms-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">The Collection</p>
            <h1 className="lp-hero__title">
              Discover Our<br />
              <em>Hotels</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              From urban sanctuaries to serene escapes, FamousGate Hotels offers premium hospitality across multiple locations.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== HOTELS GRID ===== */}
        <section className="lp-welcome" style={{ background: 'var(--warm-white)' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">Locations</p>
              <h2 className="lp-section-title">Explore Our&nbsp;<em>Properties</em></h2>
              <div className="lp-divider" />
            </Reveal>
            
            <Reveal delay={100}>
              <HotelList hotels={hotels} isLoading={isLoading} error={error || null} />
            </Reveal>
          </div>
        </section>

        {/* ===== CTA SECTION ===== */}
        <section className="lp-stats-bar" style={{ padding: '8rem 0' }}>
          <div className="lp-container">
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
              <Reveal>
                <h2 className="lp-section-title lp-section-title--light">Ready to Experience&nbsp;<em>Luxury?</em></h2>
                <div className="lp-divider" style={{ margin: '1.5rem auto 2.5rem' }} />
                <p className="lp-body-text lp-body-text--light" style={{ margin: '0 auto 3rem' }}>
                  Book your stay today and discover why guests choose FamousGate Hotels for their most memorable occasions.
                </p>
                <Link href="/#reservations" className="lp-btn lp-btn--gold">
                  Book Your Stay
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
