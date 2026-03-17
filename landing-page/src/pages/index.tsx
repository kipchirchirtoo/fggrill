import Head from 'next/head';
import { SEO } from '@/components/SEO';
import { useState, useEffect, useRef } from 'react';
import { hotelsService, FALLBACK_BRANCHES } from '@/services/hotels.service';
import { bookingService } from '@/services/booking.service';
import { emailService } from '@/services/email.service';
import { Branch } from '@/types';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import { Header, Footer } from '@/components/layout';
import { ImageGallery } from '@/components/gallery/ImageGallery';
import { GALLERY_IMAGES } from '@/config/galleryImages';

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

// Types removed as they are now imported from @/types

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>(FALLBACK_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState<number | string>('');
  // todayStr is computed client-side only (after mount) to avoid SSR/client date mismatch
  const [todayStr, setTodayStr] = useState('');

  // --- Booking States ---
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const [guestInfo, setGuestInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    setMounted(true);
    setHeroLoaded(true);
    setTodayStr(new Date().toISOString().split('T')[0]);

    // Fetch branches — fallback already shown, this refreshes with live data
    const loadBranches = async () => {
      try {
        const data = await hotelsService.fetchBranches();
        setBranches(data.filter((b: Branch) => b.status === 'active' || (b as any).status === true));
      } catch (err) {
        // Fallback branches already in state — silently ignore
        console.error('Failed to fetch branches:', err);
      }
    };
    loadBranches();

    // Load all available rooms for browsing
    const loadAllRooms = async () => {
      try {
        // Get rooms for next 7 days as default
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const checkInStr = today.toISOString().split('T')[0];
        const checkOutStr = nextWeek.toISOString().split('T')[0];

        const data = await bookingService.searchAvailableRooms({
          checkIn: checkInStr,
          checkOut: checkOutStr
        });

        console.log('🏨 Loaded all rooms:', data);
        setAllRooms(data || []);
      } catch (err) {
        console.error('Failed to load rooms:', err);
      }
    };
    loadAllRooms();
  }, []);

  const handleSearch = async () => {
    if (!selectedBranchId || !checkIn || !checkOut) {
      toast.error('Please select a branch and dates.');
      return;
    }
    setSearching(true);
    setAvailableRooms([]);
    try {
      console.log('🔍 Searching for rooms...', { branch_id: selectedBranchId, checkIn, checkOut });
      const data = await bookingService.searchAvailableRooms({
        branch_id: selectedBranchId,
        checkIn,
        checkOut
      });

      console.log('✅ Search response:', data);
      console.log('📊 Number of rooms:', Array.isArray(data) ? data.length : 'NOT AN ARRAY');

      setAvailableRooms(data);
      if (data.length === 0) {
        toast.error('No rooms available for these dates.');
      } else {
        toast.success(`Found ${data.length} available room${data.length > 1 ? 's' : ''}!`);
        console.log('🎉 Rooms set in state, scrolling to results...');
        // Scroll to results
        setTimeout(() => {
          const resultsEl = document.getElementById('search-results');
          console.log('📍 Results element:', resultsEl);
          resultsEl?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error('❌ Search failed:', err);
      toast.error('Failed to search for rooms. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestInfo.firstName || !guestInfo.lastName || !guestInfo.email || !guestInfo.phone) {
      toast.error('Please fill in all details.');
      return;
    }

    setBooking(true);
    try {
      const confirmation = await bookingService.createBooking({
        branch_id: selectedBranchId,
        check_in_date: checkIn,
        checkInDate: checkIn,
        check_out_date: checkOut,
        checkOutDate: checkOut,
        room_type_id: selectedRoom.type_id || selectedRoom.room_type_id,
        room_id: selectedRoom.id,
        adults: parseInt(guests),
        numberOfGuests: parseInt(guests),
        guestInfo,
        bookingSource: 'WEBSITE'
      });

      // Send confirmation email asynchronously (does not block UI)
      const branch = branches.find(b => b.id === selectedBranchId);
      const branchName = branch?.name || 'Famous Gates';

      // Calculate stay duration
      const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
      const roomPrice = selectedRoom.type?.base_price || 5000;
      const totalAmount = roomPrice * nights;

      emailService.sendBookingConfirmation({
        email: guestInfo.email,
        firstName: guestInfo.firstName,
        lastName: guestInfo.lastName,
        branchName: branchName,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        confirmationNumber: confirmation.confirmationNumber || confirmation.referenceNumber || confirmation.bookingId,
        roomType: selectedRoom.type?.name || 'Standard Room',
        guests: parseInt(guests),
        totalAmount: totalAmount,
        hotelName: branchName,
        hotelAddress: branch?.address || 'Nairobi, Kenya',
        hotelPhone: '0706782828',
        hotelEmail: 'famousgatesbmt@gmail.com'
      });

      setShowModal(false);
      toast.success(`Reservation Successful! Confirmation: ${confirmation.confirmationNumber || confirmation.referenceNumber}`, {
        duration: 6000,
        icon: '🎉',
      });
    } catch (err: any) {
      console.error('Booking failed:', err);
      toast.error(err.message || 'An error occurred during booking.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <>
      <div suppressHydrationWarning>
        {mounted && (
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #d4af37',
                padding: '16px',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: '#d4af37',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        )}
      </div>
      <SEO
        title="FamousGate Hotels — Luxury Stay & Fine Dining in Nairobi, Kenya"
        description="Experience the pinnacle of hospitality at FamousGate Hotels. Premium rooms, world-class dining, and elegant event spaces in Nairobi, Kenya. Book your luxury stay today."
        breadcrumbs={[]}
      />
      <Head>
        <meta name="keywords" content="luxury hotels Nairobi, FamousGate Hotels, premium accommodation Kenya, fine dining Nairobi, hotel booking Kenya, luxury stay Nairobi, conference facilities Kenya, wedding venues Nairobi, corporate events Kenya, boutique hotels Nairobi" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo_official.png" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "FamousGate Hotels",
              "url": "https://famousgatehotels.com",
              "logo": "https://famousgatehotels.com/logo_official.png",
              "description": "Luxury hotel chain offering premium accommodations, fine dining, and event spaces in Kenya",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE",
                "addressLocality": "Nairobi"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+254-706-782828",
                "contactType": "customer service",
                "email": "famousgatesbmt@gmail.com",
                "availableLanguage": ["English", "Swahili"]
              },
              "sameAs": [
                "https://www.facebook.com/famousgate",
                "https://www.instagram.com/famousgateshotel/",
                "https://www.tiktok.com/@famousgateshotel"
              ]
            })
          }}
        />

        {/* Structured Data - Hotel */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Hotel",
              "name": "FamousGate Hotels",
              "image": "https://famousgatehotels.com/hero-bg.jpg",
              "description": "Experience the pinnacle of hospitality at FamousGate Hotels. Premium rooms, world-class dining, and elegant event spaces.",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE",
                "addressLocality": "Nairobi"
              },
              "telephone": "+254-706-782828",
              "email": "famousgatesbmt@gmail.com",
              "priceRange": "KES 5,000 - 15,000",
              "starRating": {
                "@type": "Rating",
                "ratingValue": "5"
              },
              "amenityFeature": [
                { "@type": "LocationFeatureSpecification", "name": "Free WiFi" },
                { "@type": "LocationFeatureSpecification", "name": "Restaurant" },
                { "@type": "LocationFeatureSpecification", "name": "Room Service" },
                { "@type": "LocationFeatureSpecification", "name": "Conference Facilities" },
                { "@type": "LocationFeatureSpecification", "name": "Parking" },
                { "@type": "LocationFeatureSpecification", "name": "Air Conditioning" }
              ],
              "checkinTime": "14:00",
              "checkoutTime": "11:00"
            })
          }}
        />

        {/* Structured Data - LocalBusiness */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "FamousGate Hotels",
              "image": "https://famousgatehotels.com/hero-bg.jpg",
              "url": "https://famousgatehotels.com",
              "telephone": "+254-706-782828",
              "email": "famousgatesbmt@gmail.com",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE",
                "addressLocality": "Nairobi"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "-1.286389",
                "longitude": "36.817223"
              },
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                "opens": "00:00",
                "closes": "23:59"
              },
              "priceRange": "KES 5,000 - 15,000"
            })
          }}
        />
      </Head>

      {/* ===== NAVIGATION ===== */}
      <Header />

      {/* ===== HERO ===== */}
      <section id="top" className="lp-hero">
        <div className="lp-hero__bg" style={{ backgroundImage: "url('/hero-bg.jpg')" }} />
        <div className="lp-hero__overlay" />
        {/* suppressHydrationWarning: heroLoaded class is applied via useEffect, so SSR renders
            without 'loaded' but client adds it immediately — safe to suppress */}
        <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
          <p className="lp-hero__eyebrow">Luxury Stay · Fine Dining</p>
          <h1 className="lp-hero__title">
            Where Luxury Meets<br />
            <em>Exceptional Comfort</em>
          </h1>
          <div className="lp-hero__divider" />
          <p className="lp-hero__subtitle">
            A sanctuary of refinement and elegance, crafted for your ultimate comfort and relaxation.
          </p>
          <div className="lp-hero__actions">
            <a href="#reservations" className="lp-btn lp-btn--primary">Book Your Stay</a>
            <a href="#experience" className="lp-btn lp-btn--ghost">Explore the Experience</a>
          </div>
        </div>
        <div className="lp-hero__scroll-hint">
          <span>Scroll</span>
          <div className="lp-hero__scroll-line" />
        </div>
      </section>

      {/* ===== INTRO MARQUEE STRIP ===== */}
      <div className="lp-marquee-strip" aria-hidden="true">
        <div className="lp-marquee-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="lp-marquee-item">
              Exceptional Hospitality &nbsp;&middot;&nbsp; Luxury Stay &nbsp;&middot;&nbsp; Private Events &nbsp;&middot;&nbsp; Award-Winning Cuisine &nbsp;&middot;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ===== WELCOME / INTRO ===== */}
      <section className="lp-welcome" id="experience">
        <div className="lp-container">
          <div className="lp-welcome__grid">
            <Reveal className="lp-welcome__text-col">
              <p className="lp-eyebrow">Welcome to FamousGate Hotels</p>
              <h2 className="lp-section-title">An Infinite Escape<br /><em>Into Comfort</em></h2>
              <div className="lp-divider" />
              <p className="lp-body-text">
                FamousGate Hotels is not simply a destination — it is a sanctuary. From our meticulously designed suites to our world-class dining and serene surroundings, every detail is crafted to transport you.
              </p>
              <p className="lp-body-text" style={{ marginTop: '1.25rem' }}>
                Nestled in the heart of elegance and prepared for refined guests, our dedicated team works tirelessly to ensure that every stay becomes a cherished memory.
              </p>
              <a href="#dining" className="lp-link-arrow" style={{ marginTop: '2rem', display: 'inline-flex' }}>
                Discover Our Story
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </Reveal>

            <Reveal delay={150} className="lp-welcome__img-col">
              <div className="lp-welcome__img-card">
                <img src="/rooms-bg.jpg" alt="Luxury room at FamousGate Hotels" />
                <div className="lp-welcome__badge">
                  <span className="lp-welcome__badge-num">15+</span>
                  <span className="lp-welcome__badge-label">Years of Excellence</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <div className="lp-stats-bar">
        <div className="lp-container">
          <div className="lp-stats-bar__grid">
            {[
              { num: '500+', label: 'Successful Stays' },
              { num: '98%', label: 'Guest Satisfaction' },
              { num: '60+', label: 'Luxury Rooms' },
              { num: '200+', label: 'Curated Wine Labels' },
            ].map((stat, i) => (
              <Reveal key={i} delay={i * 100} className="lp-stat">
                <div className="lp-stat__num">{stat.num}</div>
                <div className="lp-stat__label">{stat.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ===== DINING EXPERIENCE ===== */}
      <section className="lp-dining" id="dining">
        <div className="lp-dining__bg" style={{ backgroundImage: "url('/dining-bg.jpg')" }} />
        <div className="lp-dining__overlay" />
        <div className="lp-container lp-dining__content">
          <Reveal className="lp-dining__text">
            <p className="lp-eyebrow lp-eyebrow--light">The Culinary Journey</p>
            <h2 className="lp-section-title lp-section-title--light">
              Gourmet Dining.<br /><em>Masterfully Served.</em>
            </h2>
            <div className="lp-divider lp-divider--gold" />
            <p className="lp-body-text lp-body-text--light">
              Our culinary team brings world-class flavours to your table. From local specialities to international favourites, every dish is a celebration of taste and refinement.
            </p>
            <div className="lp-dining__features">
              {[
                { icon: '🔥', title: 'Open-Fire Grill', desc: 'Theatrical live-fire cooking at its finest' },
                { icon: '🥩', title: 'Premium Cuts', desc: 'Hand-selected wagyu and dry-aged specialities' },
                { icon: '🍷', title: 'Wine Pairing', desc: 'Sommelier-curated pairings for every dish' },
              ].map((f, i) => (
                <Reveal key={i} delay={i * 120} className="lp-dining__feature">
                  <div className="lp-dining__feature-icon">{f.icon}</div>
                  <div>
                    <div className="lp-dining__feature-title">{f.title}</div>
                    <div className="lp-dining__feature-desc">{f.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>
            <a href="#reservations" className="lp-btn lp-btn--gold" style={{ marginTop: '2.5rem', display: 'inline-block' }}>
              View the Menu
            </a>
          </Reveal>
        </div>
      </section>

      {/* ===== EXPERIENCE CARDS ===== */}
      <section className="lp-experiences">
        <div className="lp-container">
          <Reveal className="lp-section-header">
            <p className="lp-eyebrow">Crafted for Every Occasion</p>
            <h2 className="lp-section-title">Discover the&nbsp;<em>FG Experience</em></h2>
            <div className="lp-divider" />
          </Reveal>

          <div className="lp-cards">
            {[
              {
                tag: 'Dining',
                title: 'Gourmet Dining Experience',
                desc: 'A world-class culinary journey through seasonal creations, paired with exceptional wines.',
                img: '/dining-bg.jpg',
                link: '#dining',
              },
              {
                tag: 'Stay',
                title: 'Luxury Accommodations',
                desc: 'Meticulously designed rooms and suites offered for your ultimate comfort and rest.',
                img: '/rooms-bg.jpg',
                link: '#reservations',
              },
              {
                tag: 'Events',
                title: 'Private & Corporate Events',
                desc: 'Bespoke event experiences for celebrations, corporate meetings, and milestone occasions.',
                img: '/events-bg.jpg',
                link: '#events',
              },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 130} className="lp-card">
                <div className="lp-card__img" style={{ backgroundImage: `url('${card.img}')` }}>
                  <span className="lp-card__tag">{card.tag}</span>
                </div>
                <div className="lp-card__body">
                  <h3 className="lp-card__title">{card.title}</h3>
                  <p className="lp-card__desc">{card.desc}</p>
                  <a href={card.link} className="lp-link-arrow">
                    Learn More
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="lp-testimonials">
        <div className="lp-container">
          <Reveal className="lp-section-header">
            <p className="lp-eyebrow lp-eyebrow--gold">Guest Voices</p>
            <h2 className="lp-section-title">What Our Guests&nbsp;<em>Say</em></h2>
            <div className="lp-divider lp-divider--gold" />
          </Reveal>
          <div className="lp-testimonials__grid">
            {[
              { quote: "An extraordinary stay. Every detail was perfect — from the breakfast at the dining hall to the comfort of the rooms.", author: 'Alexandra M.', title: 'Returning Guest' },
              { quote: "FamousGate is our top choice for conferences. The events team goes above and beyond every single time.", author: 'James D.', title: 'Corporate Client' },
              { quote: "A world-class experience from arrival to check-out. The hospitality is simply unmatched in the region.", author: 'Sofia K.', title: 'Travel Blogger' },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 150} className="lp-testimonial">
                <div className="lp-testimonial__stars">★ ★ ★ ★ ★</div>
                <p className="lp-testimonial__quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="lp-testimonial__author">
                  <div className="lp-testimonial__author-name">{t.author}</div>
                  <div className="lp-testimonial__author-title">{t.title}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BRANCHES SECTION ===== */}
      <section className="lp-branches" id="branches">
        <div className="lp-container">
          <Reveal className="lp-section-header">
            <p className="lp-eyebrow">Our Locations</p>
            <h2 className="lp-section-title">Discover Our&nbsp;<em>Branches</em></h2>
            <div className="lp-divider" />
            <p className="lp-body-text" style={{ maxWidth: '700px', margin: '1rem auto 0' }}>
              From urban sanctuaries to serene escapes, FamousGate Hotels offers premium hospitality across multiple locations. Select a branch to begin your journey with us.
            </p>
          </Reveal>

          <div className="lp-branches__grid">
            {branches.length > 0 ? (
              branches.map((branch, i) => (
                <Reveal key={branch.id} delay={i * 100} className="lp-branch-card">
                  <div className="lp-branch-card__body">
                    <h3 className="lp-branch-card__title">{branch.name}</h3>
                    <p className="lp-branch-card__location">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {branch.location}
                    </p>
                    <div className="lp-branch-card__divider" />
                    <p className="lp-branch-card__address">{branch.address}</p>
                    <a
                      href="#reservations"
                      className="lp-btn lp-btn--outline"
                      onClick={() => setSelectedBranchId(branch.id)}
                    >
                      Book This Branch
                    </a>
                  </div>
                </Reveal>
              ))
            ) : (
              <div className="lp-no-data">More locations coming soon.</div>
            )}
          </div>
        </div>
      </section>

      {/* ===== EVENTS SECTION ===== */}
      <section className="lp-events" id="events">
        <div className="lp-events__img" style={{ backgroundImage: "url('/events-bg.jpg')" }} />
        <div className="lp-events__content">
          <Reveal>
            <p className="lp-eyebrow lp-eyebrow--light">Private Gatherings</p>
            <h2 className="lp-section-title lp-section-title--light">
              Celebrate Every<br /><em>Milestone in Style</em>
            </h2>
            <div className="lp-divider lp-divider--gold" />
            <p className="lp-body-text lp-body-text--light">
              From intimate anniversaries to high-profile corporate galas, our events team crafts bespoke dining experiences that leave lasting impressions. Our private dining rooms and terraces accommodate groups of any size.
            </p>
            <ul className="lp-events__list">
              {['Private Dining Rooms', 'Corporate Luncheons & Dinners', 'Wedding Receptions', 'Birthday Celebrations', 'Wine Pairing Evenings'].map((item) => (
                <li key={item} className="lp-events__list-item">
                  <span className="lp-events__check">✦</span> {item}
                </li>
              ))}
            </ul>
            <a href="#reservations" className="lp-btn lp-btn--gold" style={{ marginTop: '2.5rem', display: 'inline-block' }}>
              Enquire About Events
            </a>
          </Reveal>
        </div>
      </section>

      {/* ===== RESERVATION CTA ===== */}
      <section className="lp-reservation" id="reservations">
        <Reveal className="lp-reservation__inner">
          <p className="lp-eyebrow lp-eyebrow--gold">Begin Your Stay</p>
          <h2 className="lp-section-title lp-section-title--light">Book Your<br /><em>Stay Today</em></h2>
          <div className="lp-divider lp-divider--gold" />
          <p className="lp-body-text lp-body-text--light" style={{ maxWidth: '540px', margin: '0 auto 2.5rem' }}>
            Join us for an evening you will long remember. Our reservations team is ready to tailor the perfect dining experience for you.
          </p>
          <div className="lp-reservation__form">
            <div className="lp-reservation__fields">
              <div className="lp-field">
                <label className="lp-field__label">Branch</label>
                <select
                  className="lp-field__input"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                >
                  <option value="">Select a Branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="lp-field">
                <label className="lp-field__label">Check-In</label>
                <input
                  type="date"
                  className="lp-field__input"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={todayStr || undefined}
                />
              </div>
              <div className="lp-field">
                <label className="lp-field__label">Check-Out</label>
                <input
                  type="date"
                  className="lp-field__input"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn || todayStr || undefined}
                />
              </div>
              <div className="lp-field">
                <label className="lp-field__label">Guests</label>
                <select
                  className="lp-field__input"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
            <button
              className="lp-btn lp-btn--gold lp-reservation__btn"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? 'Searching...' : 'Check Availability'}
            </button>
          </div>
          <p className="lp-reservation__note">
            For inquiries or group bookings, please <a href="tel:0706782828">call us at 0706782828</a> or email <a href="mailto:famousgatesbmt@gmail.com">famousgatesbmt@gmail.com</a>
          </p>
        </Reveal>
      </section>

      {/* ===== SEARCH RESULTS ===== */}
      {availableRooms.length > 0 && (
        <section className="lp-results" id="search-results">
          <div className="lp-container">
            <Reveal className="lp-section-header" style={{ marginBottom: '2rem' }}>
              <p className="lp-eyebrow">Search Results</p>
              <h2 className="lp-section-title">Available&nbsp;<em>Accommodations</em></h2>
              <div className="lp-divider" />
            </Reveal>

            <div className="lp-results__grid">
              {availableRooms.map((room, i) => (
                <Reveal key={room.id} delay={i * 100} className="lp-room-card">
                  <div className="lp-room-card__header">
                    <div className="lp-room-card__type">{room.type?.name || 'Luxury Room'}</div>
                    <h3 className="lp-room-card__title">Room {room.room_number}</h3>
                  </div>
                  <div className="lp-room-card__body">
                    <div className="lp-room-card__price">
                      <span className="lp-room-card__price-val">KES {room.type?.base_price?.toLocaleString() || '5,000'}</span>
                      <span className="lp-room-card__price-unit">/ night</span>
                    </div>
                    <ul className="lp-room-card__features">
                      <li className="lp-room-card__feature"><span>✦</span> King Bed</li>
                      <li className="lp-room-card__feature"><span>✦</span> Free Wifi</li>
                      <li className="lp-room-card__feature"><span>✦</span> Smart TV</li>
                      <li className="lp-room-card__feature"><span>✦</span> Minibar</li>
                    </ul>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="lp-btn lp-btn--outline"
                        style={{ flex: 1, textAlign: 'center' }}
                        onClick={() => setShowGallery(true)}
                      >
                        View Room
                      </button>
                      <button
                        className="lp-btn lp-btn--primary"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setSelectedRoom(room);
                          setShowModal(true);
                        }}
                      >
                        Reserve This Room
                      </button>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== BROWSE ALL ROOMS ===== */}
      {allRooms.length > 0 && availableRooms.length === 0 && (
        <section className="lp-results" id="all-rooms">
          <div className="lp-container">
            <Reveal className="lp-section-header" style={{ marginBottom: '2rem' }}>
              <p className="lp-eyebrow">Our Accommodations</p>
              <h2 className="lp-section-title">Browse Our&nbsp;<em>Luxury Rooms</em></h2>
              <div className="lp-divider" />
              <p className="lp-body-text" style={{ maxWidth: '700px', margin: '1rem auto 0' }}>
                Explore our collection of meticulously designed rooms and suites. Use the search above to check availability for specific dates.
              </p>
            </Reveal>

            <div className="lp-results__grid">
              {allRooms.slice(0, 12).map((room, i) => (
                <Reveal key={room.id} delay={i * 100} className="lp-room-card">
                  <div className="lp-room-card__header">
                    <div className="lp-room-card__type">{room.type?.name || 'Luxury Room'}</div>
                    <h3 className="lp-room-card__title">Room {room.room_number}</h3>
                  </div>
                  <div className="lp-room-card__body">
                    <div className="lp-room-card__price">
                      <span className="lp-room-card__price-val">KES {room.type?.base_price?.toLocaleString() || '5,000'}</span>
                      <span className="lp-room-card__price-unit">/ night</span>
                    </div>
                    <ul className="lp-room-card__features">
                      <li className="lp-room-card__feature"><span>✦</span> King Bed</li>
                      <li className="lp-room-card__feature"><span>✦</span> Free Wifi</li>
                      <li className="lp-room-card__feature"><span>✦</span> Smart TV</li>
                      <li className="lp-room-card__feature"><span>✦</span> Minibar</li>
                    </ul>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        className="lp-btn lp-btn--outline"
                        style={{ flex: 1, textAlign: 'center' }}
                        onClick={() => setShowGallery(true)}
                      >
                        View Room
                      </button>
                      <a
                        href="#reservations"
                        className="lp-btn lp-btn--primary"
                        style={{ flex: 1, textAlign: 'center', display: 'block' }}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('reservations')?.scrollIntoView({ behavior: 'smooth' });
                          toast('Please select dates to check availability for this room', {
                            icon: 'ℹ️',
                            duration: 4000
                          });
                        }}
                      >
                        Reserve Now
                      </a>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {allRooms.length > 12 && (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <p className="lp-body-text">
                  Showing 12 of {allRooms.length} available rooms. Use the search above to find rooms for your specific dates.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== BOOKING MODAL ===== */}
      {showModal && selectedRoom && (
        <div className="lp-modal-overlay">
          <div className="lp-modal">
            <button className="lp-modal__close" onClick={() => setShowModal(false)}>&times;</button>
            <h2 className="lp-modal__title">Complete Your&nbsp;<em>Booking</em></h2>
            <p className="lp-modal__subtitle">You&apos;re reserving Room {selectedRoom.room_number} at our {branches.find(b => b.id.toString() === selectedBranchId.toString())?.name || 'selected'} branch.</p>

            <form onSubmit={handleBookingSubmit} className="lp-modal__form">
              <div className="lp-modal__form-grid">
                <div className="lp-field">
                  <label className="lp-field__label">First Name</label>
                  <input
                    type="text"
                    className="lp-field__input"
                    required
                    value={guestInfo.firstName}
                    onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value })}
                  />
                </div>
                <div className="lp-field">
                  <label className="lp-field__label">Last Name</label>
                  <input
                    type="text"
                    className="lp-field__input"
                    required
                    value={guestInfo.lastName}
                    onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value })}
                  />
                </div>
                <div className="lp-modal__field--full lp-field">
                  <label className="lp-field__label">Email Address</label>
                  <input
                    type="email"
                    className="lp-field__input"
                    required
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                  />
                </div>
                <div className="lp-modal__field--full lp-field">
                  <label className="lp-field__label">Phone Number</label>
                  <input
                    type="tel"
                    className="lp-field__input"
                    required
                    value={guestInfo.phone}
                    onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="lp-modal__summary">
                <div className="lp-modal__summary-row">
                  <span>Stay Duration:</span>
                  <span>{checkIn} to {checkOut}</span>
                </div>
                <div className="lp-modal__summary-row">
                  <span>Guests:</span>
                  <span>{guests} Person(s)</span>
                </div>
                <div className="lp-modal__summary-row lp-modal__summary-total">
                  <span>Total Amount (Est):</span>
                  <span>KES {selectedRoom.type?.base_price?.toLocaleString() || '5,000'}</span>
                </div>
              </div>

              <button
                type="submit"
                className="lp-btn lp-btn--gold"
                style={{ width: '100%', marginTop: '2rem' }}
                disabled={booking}
              >
                {booking ? 'Processing...' : 'Confirm Reservation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== NEWSLETTER SECTION ===== */}
      <section className="lp-newsletter">
        <div className="lp-container">
          <Reveal className="lp-newsletter__card">
            <div className="lp-newsletter__content">
              <p className="lp-eyebrow lp-eyebrow--gold">The Collection</p>
              <h2 className="lp-section-title lp-section-title--light">Join Our&nbsp;<em>Circle</em></h2>
              <p className="lp-body-text lp-body-text--light">
                Subscribe to receive exclusive offers, seasonal news, and invitations to private events directly in your inbox.
              </p>
              <form
                className="lp-newsletter__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = (e.target as any).email.value;
                  if (email) {
                    toast.success('Thank you for subscribing! We have sent a welcome gift to your inbox.', {
                      duration: 5000,
                      icon: '📧',
                    });
                    // In a real scenario, we would call emailService.sendNewsletter or a signup API
                    (e.target as any).reset();
                  }
                }}
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Your Primary Email Address"
                  className="lp-newsletter__input"
                  required
                />
                <button type="submit" className="lp-btn lp-btn--gold">Subscribe</button>
              </form>
              <p className="lp-newsletter__privacy">
                By subscribing, you agree to our Privacy Policy and consent to receive marketing communications.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== IMAGE GALLERY MODAL ===== */}
      <ImageGallery
        images={GALLERY_IMAGES}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        initialIndex={0}
      />

      {/* ===== FOOTER ===== */}
      <Footer />
    </>
  );
}
