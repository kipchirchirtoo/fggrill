import { SEO } from '@/components/SEO';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { Header, Footer } from '@/components/layout';

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

export default function Events() {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    setHeroLoaded(true);
  }, []);

  return (
    <>
      <SEO
        title="Events & Celebrations — FamousGate Hotels | Event Spaces in Bomet"
        description="Bomet Kenya — Host your next milestone at FamousGate Hotels. From corporate conferences to elegant weddings, our Bomet venues offer the perfect backdrop."
        url="https://famousgatehotels.com/events"
        breadcrumbs={[
          { name: "Events", item: "/events" }
        ]}
      />
      <Head>
        <meta name="keywords" content="events bomet, wedding venue bomet, conference facilities kenya, corporate events bomet" />
      </Head>

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/events-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">The Grand Stage</p>
            <h1 className="lp-hero__title">
              Milestones Defined<br />
              <em>By Elegance</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              From intimate gatherings to grand celebrations, we provide the perfect canvas for your most cherished moments.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== EVENTS INTRO ===== */}
        <section className="lp-welcome">
          <div className="lp-container">
            <div className="lp-welcome__grid">
              <Reveal className="lp-welcome__text-col">
                <p className="lp-eyebrow">Private & Corporate</p>
                <h2 className="lp-section-title">Bespoke Event<br /><em>Experiences</em></h2>
                <div className="lp-divider" />
                <p className="lp-body-text">
                  Our dedicated events team works tirelessly to ensure that every celebration, meeting, or milestone becomes a cherished memory. We offer versatile venues equipped with state-of-the-art technology.
                </p>
                <p className="lp-body-text" style={{ marginTop: '1.25rem' }}>
                  Whether it is a high-profile corporate gala or an intimate anniversary dinner, our attention to detail ensures a flawless execution every single time.
                </p>
              </Reveal>

              <Reveal delay={150} className="lp-welcome__img-col">
                <div className="lp-welcome__img-card">
                  <img src="/events-bg.jpg" alt="Events at FamousGate Hotels" />
                  <div className="lp-welcome__badge">
                    <span className="lp-welcome__badge-num">200+</span>
                    <span className="lp-welcome__badge-label">Capacity (Guests)</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===== EVENT TYPES ===== */}
        <section className="lp-experiences" style={{ background: 'var(--warm-white)', paddingBottom: '9rem' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">Our Specialities</p>
              <h2 className="lp-section-title">Host Your&nbsp;<em>Occasion</em></h2>
              <div className="lp-divider" />
            </Reveal>

            <div className="lp-cards">
              {[
                {
                  tag: 'Corporate',
                  title: 'Conferences & Meetings',
                  desc: 'State-of-the-art facilities designed for productivity, collaboration, and executive comfort.',
                  img: '/rooms-bg.jpg',
                },
                {
                  tag: 'Celebration',
                  title: 'Weddings & Galas',
                  desc: 'Breathtaking venues and bespoke services to make your special day truly unforgettable.',
                  img: '/events-bg.jpg',
                },
                {
                  tag: 'Social',
                  title: 'Private Dining',
                  desc: 'Intimate spaces for birthdays, anniversaries, and family gatherings with curated menus.',
                  img: '/dining-bg.jpg',
                },
              ].map((card, i) => (
                <Reveal key={i} delay={i * 130} className="lp-card">
                  <div className="lp-card__img" style={{ backgroundImage: `url('${card.img}')` }}>
                    <span className="lp-card__tag">{card.tag}</span>
                  </div>
                  <div className="lp-card__body">
                    <h3 className="lp-card__title">{card.title}</h3>
                    <p className="lp-card__desc">{card.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
