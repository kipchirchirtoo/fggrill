'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { hotelsService, FALLBACK_BRANCHES } from '@/services/hotels.service';
import { bookingService } from '@/services/booking.service';
import { emailService } from '@/services/email.service';
import { Branch } from '@/types';
import toast from 'react-hot-toast';
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

export default function HomeClient() {
  const [mounted, setMounted] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>(FALLBACK_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState<number | string>('');
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

    const loadBranches = async () => {
      try {
        const data = await hotelsService.fetchBranches();
        setBranches(data.filter((b: Branch) => b.status === 'active' || (b as any).status === true));
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };
    loadBranches();

    const loadAllRooms = async () => {
      try {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const checkInStr = today.toISOString().split('T')[0];
        const checkOutStr = nextWeek.toISOString().split('T')[0];
        const data = await bookingService.searchAvailableRooms({
          checkIn: checkInStr,
          checkOut: checkOutStr
        });
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
      const data = await bookingService.searchAvailableRooms({
        branch_id: selectedBranchId,
        checkIn,
        checkOut
      });
      setAvailableRooms(data);
      if (data.length === 0) {
        toast.error('No rooms available for these dates.');
      } else {
        toast.success(`Found ${data.length} available room${data.length > 1 ? 's' : ''}!`);
        setTimeout(() => {
          document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
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

      const branch = branches.find(b => b.id === selectedBranchId);
      const branchName = branch?.name || 'Famous Gates';
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
      toast.success(`Reservation Successful! Confirmation: ${confirmation.confirmationNumber}`, {
        duration: 6000,
        icon: '🎉',
      });
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during booking.');
    } finally {
      setBooking(false);
    }
  };

  if (!mounted) return null;

  return (
    <main>
      <Header />

      {/* HERO SECTION — SEO Optimized H1 */}
      <section id="top" className="lp-hero" aria-label="Hero">
        <div className="lp-hero__bg">
           <Image
            src="/hero-bg.jpg"
            alt="Famous Gates Hotels exterior entrance Nairobi Kenya"
            fill
            priority
            className="object-cover"
            quality={85}
          />
        </div>
        <div className="lp-hero__overlay" />
        <div className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
          <p className="lp-hero__eyebrow">Luxury Stay · Fine Dining</p>
          <h1 className="lp-hero__title">
            Famous Gates Hotels — Nairobi&apos;s Premier Luxury Hotel Experience
          </h1>
          <div className="lp-hero__divider" />
          <p className="lp-hero__subtitle">
            Located in the heart of Nairobi, Kenya. Luxury accommodation,
            fine dining at FG Grill, and world-class conference facilities.
          </p>
          <div className="lp-hero__actions">
            <a href="#reservations" className="lp-btn lp-btn--primary" aria-label="Book a room at Famous Gates Hotels">
              Book Direct — Best Rate Guaranteed
            </a>
            <a href="#experience" className="lp-btn lp-btn--ghost">Explore the Experience</a>
          </div>
        </div>
        <div className="lp-hero__scroll-hint">
          <span>Scroll</span>
          <div className="lp-hero__scroll-line" />
        </div>
      </section>

      {/* MARQUEE */}
      <div className="lp-marquee-strip" aria-hidden="true">
        <div className="lp-marquee-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="lp-marquee-item">
              Exceptional Hospitality &nbsp;&middot;&nbsp; Luxury Stay &nbsp;&middot;&nbsp; Private Events &nbsp;&middot;&nbsp; Award-Winning Cuisine &nbsp;&middot;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* WELCOME SECTION */}
      <section className="lp-welcome" id="experience" aria-labelledby="experience-heading">
        <div className="lp-container">
          <div className="lp-welcome__grid">
            <Reveal className="lp-welcome__text-col">
              <p className="lp-eyebrow">Welcome to Famous Gates Hotels</p>
              <h2 id="experience-heading" className="lp-section-title">An Infinite Escape<br /><em>Into Comfort</em></h2>
              <div className="lp-divider" />
              <p className="lp-body-text">
                Famous Gates Hotels is Nairobi&apos;s premier luxury destination. From our meticulously designed suites to our world-class dining and serene surroundings, every detail is crafted to transport you.
              </p>
              <p className="lp-body-text" style={{ marginTop: '1.25rem' }}>
                Nestled in the heart of elegance and prepared for refined guests, our dedicated team works tirelessly to ensure that every stay becomes a cherished memory.
              </p>
              <a href="/about" className="lp-link-arrow" style={{ marginTop: '2rem', display: 'inline-flex' }}>
                Discover Our Story
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </Reveal>

            <Reveal delay={150} className="lp-welcome__img-col">
              <div className="lp-welcome__img-card">
                <Image
                  src="/rooms-bg.jpg"
                  alt="Luxury room at Famous Gates Hotels Nairobi Kenya"
                  width={600}
                  height={800}
                  className="rounded-lg object-cover"
                />
                <div className="lp-welcome__badge">
                  <span className="lp-welcome__badge-num">15+</span>
                  <span className="lp-welcome__badge-label">Years of Excellence</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ROOMS SECTION — SEO Optimized */}
      <section id="rooms" className="lp-experiences" aria-labelledby="rooms-heading">
        <div className="lp-container">
          <Reveal className="lp-section-header">
            <p className="lp-eyebrow">Stay With Us</p>
            <h2 id="rooms-heading" className="lp-section-title">Luxury Rooms &amp; Suites</h2>
            <div className="lp-divider" />
            <p className="lp-body-text" style={{ maxWidth: '800px', margin: '1rem auto' }}>
              From elegantly appointed standard rooms to spacious executive suites,
              every room at Famous Gates Hotels is designed for comfort and style.
              Enjoy complimentary WiFi, room service, and stunning Nairobi views.
            </p>
          </Reveal>

          <div className="lp-cards">
             {[
              {
                tag: 'Standard',
                title: 'Deluxe Comfort Room',
                desc: 'Elegantly designed for the modern traveler with premium amenities.',
                img: '/rooms-bg.jpg',
                link: '/rooms',
              },
              {
                tag: 'Executive',
                title: 'Executive Suite',
                desc: 'Spacious suites offering unparalleled luxury and panoramic city views.',
                img: '/hero-bg.jpg',
                link: '/rooms',
              },
              {
                tag: 'Presidential',
                title: 'Presidential Suite',
                desc: 'The ultimate luxury experience with dedicated service and premium features.',
                img: '/dining-bg.jpg',
                link: '/rooms',
              },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 130} className="lp-card">
                <div className="lp-card__img relative h-64 w-full">
                  <Image src={card.img} alt={`${card.title} at Famous Gates Hotels Nairobi`} fill className="object-cover" />
                  <span className="lp-card__tag absolute top-4 left-4">{card.tag}</span>
                </div>
                <div className="lp-card__body">
                  <h3 className="lp-card__title">{card.title}</h3>
                  <p className="lp-card__desc">{card.desc}</p>
                  <a href={card.link} className="lp-link-arrow">
                    View Details
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

      {/* FG GRILL SECTION — SEO Optimized */}
      <section id="dining" className="lp-dining" aria-labelledby="restaurant-heading">
        <div className="lp-dining__bg">
          <Image
            src="/dining-bg.jpg"
            alt="FG Grill fine dining restaurant at Famous Gates Hotels Nairobi"
            fill
            className="object-cover"
            loading="lazy"
          />
        </div>
        <div className="lp-dining__overlay" />
        <div className="lp-container lp-dining__content">
          <Reveal className="lp-dining__text">
            <p className="lp-eyebrow lp-eyebrow--light">The Culinary Journey</p>
            <h2 id="restaurant-heading" className="lp-section-title lp-section-title--light">
              FG Grill — Fine Dining Restaurant
            </h2>
            <div className="lp-divider lp-divider--gold" />
            <p className="lp-body-text lp-body-text--light">
              FG Grill is Nairobi&apos;s destination for exceptional cuisine.
              Our chefs craft signature grills, authentic Kenyan dishes, and
              international specialties using the finest locally sourced ingredients.
              Open daily for breakfast, lunch, and dinner.
            </p>
            <a href="/restaurant" className="lp-btn lp-btn--gold" style={{ marginTop: '2.5rem', display: 'inline-block' }}>
              View FG Grill Menu &amp; Reserve a Table
            </a>
          </Reveal>
        </div>
      </section>

      {/* CONFERENCE SECTION — SEO Optimized */}
      <section id="conferences" className="lp-events" aria-labelledby="conf-heading">
        <div className="lp-events__img">
           <Image
            src="/events-bg.jpg"
            alt="Conference room facilities at Famous Gates Hotels Nairobi"
            fill
            className="object-cover"
            loading="lazy"
          />
        </div>
        <div className="lp-events__content">
          <Reveal>
            <p className="lp-eyebrow lp-eyebrow--light">Business & Events</p>
            <h2 id="conf-heading" className="lp-section-title lp-section-title--light">
              Conference &amp; Event Facilities in Nairobi
            </h2>
            <div className="lp-divider lp-divider--gold" />
            <p className="lp-body-text lp-body-text--light">
              Famous Gates Hotels offers Nairobi&apos;s most comprehensive
              conference and banquet facilities. Host corporate meetings, workshops,
              seminars, weddings, and private events with full AV support and catering.
            </p>
            <ul className="lp-events__list">
              {['State-of-the-art AV Equipment', 'High-Speed Business WiFi', 'Bespoke Event Catering', 'Executive Boardrooms', 'Grand Banquet Halls'].map((item) => (
                <li key={item} className="lp-events__list-item">
                  <span className="lp-events__check">✦</span> {item}
                </li>
              ))}
            </ul>
            <a href="/conferences" className="lp-btn lp-btn--gold" style={{ marginTop: '2.5rem', display: 'inline-block' }}>
              Explore Conference Packages
            </a>
          </Reveal>
        </div>
      </section>

      {/* FAQ SECTION — Required for FAQPage schema */}
      <section id="faq" className="lp-testimonials" aria-labelledby="faq-heading">
        <div className="lp-container">
          <Reveal className="lp-section-header">
            <p className="lp-eyebrow lp-eyebrow--gold">Support</p>
            <h2 id="faq-heading" className="lp-section-title">Frequently Asked Questions</h2>
            <div className="lp-divider lp-divider--gold" />
          </Reveal>

          <div className="max-w-3xl mx-auto space-y-4 mt-12">
            {[
              { q: 'Where is Famous Gates Hotels located?', a: 'Famous Gates Hotels is located in Nairobi, Kenya at Famous Gates Building, Ngong Road.' },
              { q: 'What time is check-in at Famous Gates Hotels?', a: 'Check-in is at 12:00 PM. Check-out is at 10:00 AM.' },
              { q: 'Does Famous Gates Hotels have a restaurant?', a: 'Yes. FG Grill is our signature restaurant serving Kenyan, continental, and international cuisine, open 7 days a week.' },
              { q: 'How do I book a room at Famous Gates Hotels?', a: 'Book directly at famousgates.com/book for the best rates. You can also call +254-706-782828.' },
              { q: 'Does Famous Gates have conference facilities?', a: 'Yes. We offer fully-equipped conference rooms, banquet halls, and event spaces for corporate and private functions.' },
            ].map((faq, i) => (
              <details key={i} className="group bg-white/5 border border-white/10 rounded-lg p-6 cursor-pointer">
                <summary className="font-heading text-xl text-white list-none flex justify-between items-center">
                  {faq.q}
                  <span className="text-gold group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <p className="mt-4 text-gray-300 leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* RESERVATIONS FORM */}
      <section id="reservations" className="lp-reservation">
        <Reveal className="lp-reservation__inner">
          <p className="lp-eyebrow lp-eyebrow--gold">Begin Your Stay</p>
          <h2 className="lp-section-title lp-section-title--light">Book Your<br /><em>Stay Today</em></h2>
          <div className="lp-divider lp-divider--gold" />
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
            For inquiries or group bookings, please <a href="tel:+254706782828">call us at +254 706 782 828</a> or email <a href="mailto:info@famousgates.com">info@famousgates.com</a>
          </p>
        </Reveal>
      </section>

      {/* NAP BLOCK — Consistent Name, Address, Phone */}
      <section id="contact-info" className="py-20 bg-black/50" aria-label="Contact information">
        <div className="lp-container text-center">
          <address className="not-italic">
            <strong className="text-gold text-2xl font-heading mb-4 block">Famous Gates Hotels</strong>
            <p className="text-gray-300 text-lg mb-2">Famous Gates Building, Ngong Road</p>
            <p className="text-gray-300 text-lg mb-4">Nairobi, Kenya 00100</p>
            <div className="space-y-2">
              <a href="tel:+254706782828" className="text-white hover:text-gold text-xl block">+254 706 782 828</a>
              <a href="mailto:info@famousgates.com" className="text-white hover:text-gold text-xl block">info@famousgates.com</a>
            </div>
          </address>
        </div>
      </section>

      {/* SEARCH RESULTS (IF ANY) */}
      {availableRooms.length > 0 && (
         <section className="lp-results" id="search-results">
          <div className="lp-container">
            <div className="lp-results__grid">
              {availableRooms.map((room, i) => (
                <div key={room.id} className="lp-room-card">
                   <div className="lp-room-card__header">
                    <div className="lp-room-card__type">{room.type?.name || 'Luxury Room'}</div>
                    <h3 className="lp-room-card__title">Room {room.room_number}</h3>
                  </div>
                   <div className="lp-room-card__body">
                    <div className="lp-room-card__price">
                      <span className="lp-room-card__price-val">KES {room.type?.base_price?.toLocaleString() || '5,000'}</span>
                      <span className="lp-room-card__price-unit">/ night</span>
                    </div>
                    <button
                      className="lp-btn lp-btn--primary w-full mt-4"
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowModal(true);
                      }}
                    >
                      Reserve This Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
         </section>
      )}

      {/* MODAL */}
      {showModal && selectedRoom && (
        <div className="lp-modal-overlay">
          <div className="lp-modal">
             <button className="lp-modal__close" onClick={() => setShowModal(false)}>&times;</button>
            <h2 className="lp-modal__title">Complete Your&nbsp;<em>Booking</em></h2>
            <form onSubmit={handleBookingSubmit} className="lp-modal__form">
               <div className="lp-modal__form-grid">
                <input type="text" placeholder="First Name" className="lp-field__input" required value={guestInfo.firstName} onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value })} />
                <input type="text" placeholder="Last Name" className="lp-field__input" required value={guestInfo.lastName} onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value })} />
                <input type="email" placeholder="Email" className="lp-field__input" required value={guestInfo.email} onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })} />
                <input type="tel" placeholder="Phone" className="lp-field__input" required value={guestInfo.phone} onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })} />
              </div>
              <button type="submit" className="lp-btn lp-btn--gold w-full mt-6" disabled={booking}>
                {booking ? 'Processing...' : 'Confirm Reservation'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ImageGallery
        images={GALLERY_IMAGES}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        initialIndex={0}
      />

      <Footer />
    </main>
  );
}
