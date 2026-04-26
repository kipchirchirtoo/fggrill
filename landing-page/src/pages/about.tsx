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

export default function About() {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    setHeroLoaded(true);
  }, []);

  return (
    <>
      <SEO
        title="Our Story — FamousGate Hotels | Luxury Hospitality in Bomet"
        description="Bomet Kenya — Discover the legacy of FamousGate Hotels. From our humble beginnings to becoming the pinnacle of luxury hospitality in Bomet."
        url="https://famousgatehotels.com/about"
        breadcrumbs={[
          { name: "About Us", item: "/about" }
        ]}
      />
      <Head>
        <meta name="keywords" content="about famousgate hotels, luxury hotels bomet, hotel experience kenya, hospitality bomet" />
      </Head>

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/hero-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">Our Legacy</p>
            <h1 className="lp-hero__title">
              Crafting Timeless<br />
              <em>Experiences</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              A journey of excellence, hospitality, and the pursuit of ultimate comfort in the heart of Bomet.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== OUR STORY ===== */}
        <section className="lp-welcome">
          <div className="lp-container">
            <div className="lp-welcome__grid">
              <Reveal className="lp-welcome__text-col">
                <p className="lp-eyebrow">Our Story</p>
                <h2 className="lp-section-title">A Vision of<br /><em>Refinement</em></h2>
                <div className="lp-divider" />
                <p className="lp-body-text">
                  Founded with a simple yet profound mission: to create a home away from home where luxury is not just a status, but an experience. FamousGate Hotels began as a vision to bring world-class hospitality to Bomet.
                </p>
                <p className="lp-body-text" style={{ marginTop: '1.25rem' }}>
                  Over the years, we have grown into a collection of premier destinations, each reflecting the unique spirit of its location while maintaining the unwavering standards of the FamousGate brand.
                </p>
              </Reveal>

              <Reveal delay={150} className="lp-welcome__img-col">
                <div className="lp-welcome__img-card">
                  <img src="/rooms-bg.jpg" alt="The legacy of FamousGate Hotels" />
                  <div className="lp-welcome__badge">
                    <span className="lp-welcome__badge-num">15+</span>
                    <span className="lp-welcome__badge-label">Years of Excellence</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===== CORE VALUES ===== */}
        <section className="lp-experiences" style={{ background: 'var(--warm-white)', paddingBottom: '9rem' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">The FG Way</p>
              <h2 className="lp-section-title">Our Core&nbsp;<em>Values</em></h2>
              <div className="lp-divider" />
            </Reveal>

            <div className="lp-cards">
              {[
                {
                  tag: 'Hospitality',
                  title: 'Guest-Centric Service',
                  desc: 'Every interaction is an opportunity to exceed expectations and create lasting memories.',
                  img: '/dining-bg.jpg',
                },
                {
                  tag: 'Quality',
                  title: 'Unwavering Excellence',
                  desc: 'From the thread count of our linens to the seasoning of our dishes, perfection is our standard.',
                  img: '/rooms-bg.jpg',
                },
                {
                  tag: 'Innovation',
                  title: 'Modern Luxury',
                  desc: 'Continuously evolving to integrate the latest comforts while preserving timeless elegance.',
                  img: '/events-bg.jpg',
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

        {/* ===== STATS BAR ===== */}
        <div className="lp-stats-bar">
          <div className="lp-container">
            <div className="lp-stats-bar__grid">
              {[
                { num: '4', label: 'Premier Branches' },
                { num: '150+', label: 'Dedicated Staff' },
                { num: '10k+', label: 'Happy Guests' },
                { num: '5', label: 'Award Recognitions' },
              ].map((stat, i) => (
                <Reveal key={i} delay={i * 100} className="lp-stat">
                  <div className="lp-stat__num">{stat.num}</div>
                  <div className="lp-stat__label">{stat.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
