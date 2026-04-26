import { SEO } from '@/components/SEO';
import { Header, Footer } from '@/components/layout';
import { FALLBACK_BRANCHES } from '@/services/hotels.service';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

// ——— Scroll-reveal hook ———
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

const BRANCH_GALLERY: Record<number, string[]> = {
  1: [
    '/FG GRILL PHOTOS/IMG_8680.JPG', '/FG GRILL PHOTOS/IMG_8689.JPG',
    '/FG GRILL PHOTOS/IMG_8695.JPG', '/FG GRILL PHOTOS/IMG_8696.JPG',
    '/FG GRILL PHOTOS/IMG_8700.JPG', '/FG GRILL PHOTOS/IMG_8703.JPG',
    '/FG GRILL PHOTOS/IMG_8704.JPG', '/FG GRILL PHOTOS/IMG_8706.JPG',
  ],
  2: [
    '/FG GRILL PHOTOS/IMG_8712.JPG', '/FG GRILL PHOTOS/IMG_8715.JPG',
    '/FG GRILL PHOTOS/IMG_8722.JPG', '/FG GRILL PHOTOS/IMG_8725.JPG',
    '/FG GRILL PHOTOS/IMG_8727.JPG', '/FG GRILL PHOTOS/IMG_8729.JPG',
    '/FG GRILL PHOTOS/IMG_8732.JPG', '/FG GRILL PHOTOS/IMG_8733.JPG',
  ],
  3: [
    '/FG GRILL PHOTOS/IMG_8736.JPG', '/FG GRILL PHOTOS/IMG_8738.JPG',
    '/FG GRILL PHOTOS/IMG_8739.JPG', '/FG GRILL PHOTOS/IMG_8740.JPG',
    '/FG GRILL PHOTOS/IMG_8742.JPG', '/FG GRILL PHOTOS/IMG_8743.JPG',
    '/FG GRILL PHOTOS/IMG_8744.JPG', '/FG GRILL PHOTOS/IMG_8746.JPG',
  ],
  4: [
    '/FG GRILL PHOTOS/IMG_8749.JPG', '/FG GRILL PHOTOS/IMG_8753.JPG',
    '/FG GRILL PHOTOS/IMG_8754.JPG', '/FG GRILL PHOTOS/IMG_8755.JPG',
    '/FG GRILL PHOTOS/IMG_8757.JPG', '/FG GRILL PHOTOS/IMG_8758.JPG',
    '/FG GRILL PHOTOS/IMG_8762.JPG', '/FG GRILL PHOTOS/IMG_8763.JPG',
  ],
  5: [
    '/FG GRILL PHOTOS/IMG_8712.JPG', '/FG GRILL PHOTOS/IMG_8715.JPG',
    '/FG GRILL PHOTOS/IMG_8722.JPG', '/FG GRILL PHOTOS/IMG_8725.JPG',
    '/FG GRILL PHOTOS/IMG_8727.JPG', '/FG GRILL PHOTOS/IMG_8729.JPG',
    '/FG GRILL PHOTOS/IMG_8732.JPG', '/FG GRILL PHOTOS/IMG_8733.JPG',
  ],
};

const BRANCH_DESCRIPTIONS: Record<number, { tagline: string; story: string; highlight: string }> = {
  1: {
    tagline: 'The Crown Jewel of Bomet',
    story: 'Nestled in the heart of Kyogong, our flagship Bomet property stands as a testament to timeless elegance and warm Kenyan hospitality. Since our founding, the Kyogong branch has been the beating heart of the FamousGate Hotels family — a place where business travellers, families, and discerning guests alike find comfort, refined dining, and an experience that simply cannot be replicated.',
    highlight: 'Our most celebrated property — where the FamousGate journey began.',
  },
  2: {
    tagline: 'Urban Luxury in Bomet Town',
    story: 'Located in the bustling heart of Bomet Town, our town branch offers the perfect blend of convenience and sophistication. Designed for the modern traveller, this property provides a sanctuary of peace amidst the city\'s energy. With premium suites and artisanal dining, it is the premier choice for corporate meetings and urban stays.',
    highlight: 'The definitive urban hospitality experience in Bomet.',
  },
  3: {
    tagline: 'Bomet\'s Hidden Gem',
    story: 'The Mogogoshiek branch represents FamousGate\'s commitment to bringing luxury to every corner of Bomet County. Situated in the vibrant Mogogoshiek locality, this property serves a growing community with the same unwavering standards of excellence that define the entire FamousGate brand. Our guests here enjoy a more intimate, community-centred hospitality experience.',
    highlight: 'Intimate luxury in the heart of a thriving community.',
  },
  4: {
    tagline: 'Gateway to the South Rift',
    story: 'Strategically located in Sotik — the bustling commercial hub of southern Bomet County — our Sotik branch is the go-to destination for traders, travellers, and those seeking premium accommodation along the Bomet–Narok corridor. Experience our signature hospitality as you explore the vibrant local markets, breathtaking tea estates, and warm community spirit.',
    highlight: 'The premier stop for travellers on the Bomet–Narok corridor.',
  },
  5: {
    tagline: 'Kericho\'s Premier Destination',
    story: 'Set amidst the rolling tea-covered hills of Kericho, our Litein branch offers a serene escape from the ordinary. The cool climate, breathtaking landscapes, and our signature world-class hospitality make this branch a beloved retreat for travellers exploring the Great Rift Valley. Whether you arrive for business or leisure, you leave with memories to treasure.',
    highlight: 'Where Kericho\'s lush green landscape meets unparalleled luxury.',
  },
};

const AMENITIES = [
  { label: 'Premium Rooms' },
  { label: 'Restaurant & Bar' },
  { label: 'Free WiFi' },
  { label: 'Free Parking' },
  { label: 'Event Spaces' },
  { label: '24/7 Room Service' },
  { label: 'Laundry Service' },
  { label: 'Smart TVs' },
];

interface Props {
  branchId: string;
}

export default function HotelBranchPage({ branchId }: Props) {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  useEffect(() => { setHeroLoaded(true); }, []);

  const branch = FALLBACK_BRANCHES.find(b => String(b.id) === String(branchId));
  if (!branch) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <h1 className="text-3xl font-display text-gray-900 mb-4">Branch Not Found</h1>
      <p className="text-gray-600 mb-8">We couldn&apos;t find the hotel branch you were looking for.</p>
      <Link href="/hotels" className="lp-btn lp-btn--gold">Back to All Hotels</Link>
    </div>
  );

  const gallery = BRANCH_GALLERY[Number(branchId)] || BRANCH_GALLERY[1];
  const desc = BRANCH_DESCRIPTIONS[Number(branchId)] || BRANCH_DESCRIPTIONS[1];
  const branchShortName = branch.name.split('—')[1]?.trim() || branch.name;

  return (
    <>
      <SEO
        title={`${branch.name} — FamousGate Hotels | ${branch.location}`}
        description={`Welcome to ${branch.name} in ${branch.location}. ${desc.highlight} Premium rooms, world-class dining, and exceptional hospitality.`}
        url={`https://famousgatehotels.com/hotels/${branchId}`}
        image="/hero-bg.jpg"
        breadcrumbs={[
          { name: 'Hotels', item: '/hotels' },
          { name: branchShortName, item: `/hotels/${branchId}` },
        ]}
      />

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: `url('${gallery[0] || '/hero-bg.jpg'}')` }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">{branch.location}</p>
            <h1 className="lp-hero__title">
              Welcome to<br />
              <em>{branchShortName}</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">{desc.tagline}</p>
            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/#reservations" className="lp-btn lp-btn--gold">Book a Room</Link>
              <Link href="/menu" className="lp-btn lp-btn--outline">View Menu</Link>
            </div>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== STORY SECTION ===== */}
        <section className="lp-welcome">
          <div className="lp-container">
            <div className="lp-welcome__grid">
              <Reveal className="lp-welcome__text-col">
                <p className="lp-eyebrow">{branch.address}</p>
                <h2 className="lp-section-title">Our <em>Story</em></h2>
                <div className="lp-divider" />
                <p className="lp-body-text">{desc.story}</p>
                <div style={{ marginTop: '2rem', padding: '1.5rem 2rem', borderLeft: '3px solid var(--gold)', background: 'rgba(184,149,90,0.08)', borderRadius: '0 8px 8px 0' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                    &ldquo;{desc.highlight}&rdquo;
                  </p>
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <a href={`tel:${branch.phone}`} className="lp-btn lp-btn--gold" style={{ fontSize: '0.9rem' }}>
                    Call: {branch.phone}
                  </a>
                  <a href={`mailto:${branch.email}`} className="lp-btn lp-btn--outline" style={{ fontSize: '0.9rem' }}>
                    Email Us
                  </a>
                </div>
              </Reveal>

              <Reveal delay={150} className="lp-welcome__img-col">
                <div className="lp-welcome__img-card">
                  <img src={gallery[1] || '/rooms-bg.jpg'} alt={`${branch.name} interior`} />
                  <div className="lp-welcome__badge">
                    <span className="lp-welcome__badge-num">5 Star</span>
                    <span className="lp-welcome__badge-label">Luxury Stay</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===== AMENITIES ===== */}
        <section className="lp-experiences" style={{ background: 'var(--warm-white)', paddingBottom: '6rem' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">What We Offer</p>
              <h2 className="lp-section-title">World-Class <em>Amenities</em></h2>
              <div className="lp-divider" />
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
              {AMENITIES.map((a, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="branch-amenity">
                    <span className="branch-amenity__dot" />
                    <span className="branch-amenity__label">{a.label}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===== GALLERY ===== */}
        <section className="lp-welcome" style={{ paddingBottom: '7rem' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">Gallery</p>
              <h2 className="lp-section-title">A Glimpse of <em>{branchShortName}</em></h2>
              <div className="lp-divider" />
            </Reveal>
            <div className="branch-gallery">
              {gallery.map((src, i) => (
                <Reveal key={i} delay={i * 60} className="branch-gallery__item">
                  <button onClick={() => setSelectedImg(src)} className="branch-gallery__btn" aria-label={`View photo ${i + 1}`}>
                    <img src={src} alt={`${branch.name} — photo ${i + 1}`} loading="lazy" />
                    <div className="branch-gallery__overlay">
                      <span>View Gallery</span>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <div className="lp-stats-bar">
          <div className="lp-container">
            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto', padding: '6rem 0' }}>
              <Reveal>
                <h2 className="lp-section-title lp-section-title--light">Ready to Stay at <em>{branchShortName}?</em></h2>
                <div className="lp-divider" style={{ margin: '1.5rem auto 2rem' }} />
                <p className="lp-body-text lp-body-text--light" style={{ marginBottom: '2.5rem' }}>
                  Book directly and enjoy the best rates, exclusive packages, and our promise of a truly memorable stay.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/#reservations" className="lp-btn lp-btn--gold">Book Now</Link>
                  <Link href="/hotels" className="lp-btn lp-btn--outline" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>All Branches</Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </main>

      {/* ===== LIGHTBOX ===== */}
      {selectedImg && (
        <div className="branch-lightbox" onClick={() => setSelectedImg(null)} role="dialog" aria-modal="true">
          <button className="branch-lightbox__close" onClick={() => setSelectedImg(null)} aria-label="Close">✕</button>
          <img src={selectedImg} alt="FamousGate Hotels" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Footer />

      <style>{`
        .branch-amenity {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem 1rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.07);
          text-align: center;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .branch-amenity:hover {
          transform: translateY(-6px);
          box-shadow: 0 8px 32px rgba(184,149,90,0.18);
        }
        .branch-amenity__dot { 
          width: 8px;
          height: 8px;
          background: var(--gold);
          border-radius: 50%;
        }
        .branch-amenity__label {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--charcoal);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .branch-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1rem;
          margin-top: 3rem;
        }
        .branch-gallery__item { position: relative; }
        .branch-gallery__btn {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          overflow: hidden;
          border-radius: 12px;
          border: none;
          padding: 0;
          cursor: pointer;
          display: block;
        }
        .branch-gallery__btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }
        .branch-gallery__btn:hover img { transform: scale(1.07); }
        .branch-gallery__overlay {
          position: absolute;
          inset: 0;
          background: rgba(30,27,20,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 12px;
        }
        .branch-gallery__btn:hover .branch-gallery__overlay { opacity: 1; }

        .branch-lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.92);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          cursor: pointer;
        }
        .branch-lightbox img {
          max-width: 90vw;
          max-height: 88vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          cursor: default;
        }
        .branch-lightbox__close {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          background: rgba(255,255,255,0.15);
          border: none;
          color: white;
          font-size: 1.5rem;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .branch-lightbox__close:hover { background: rgba(184,149,90,0.7); }

        @media (max-width: 640px) {
          .branch-gallery { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </>
  );
}
