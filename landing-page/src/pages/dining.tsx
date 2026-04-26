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

export default function Dining() {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    setHeroLoaded(true);
  }, []);

  return (
    <>
      <SEO
        title="World-Class Dining — FamousGate Hotels | Fine Dining in Bomet"
        description="Bomet Kenya — Experience the pinnacle of culinary excellence at FamousGate Hotels. From local delicacies to international flavors, masterfully served in Bomet."
        url="https://famousgatehotels.com/dining"
        breadcrumbs={[
          { name: "Dining", item: "/dining" }
        ]}
      />
      <Head>
        <meta name="keywords" content="fine dining bomet, restaurant famousgate, hotel dining kenya, luxury restaurant bomet" />
      </Head>

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/dining-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">The Culinary Journey</p>
            <h1 className="lp-hero__title">
              Exquisite Flavors<br />
              <em>Masterfully Served</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              A celebration of taste and refinement, where every dish tells a story of tradition and innovation.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== DINING INTRO ===== */}
        <section className="lp-welcome">
          <div className="lp-container">
            <div className="lp-welcome__grid">
              <Reveal className="lp-welcome__text-col">
                <p className="lp-eyebrow">Gourmet Experience</p>
                <h2 className="lp-section-title">A Symphony of<br /><em>Taste</em></h2>
                <div className="lp-divider" />
                <p className="lp-body-text">
                  Our culinary team brings world-class flavours to your table. From local specialities to international favourites, every dish is a celebration of taste and refinement.
                </p>
                <p className="lp-body-text" style={{ marginTop: '1.25rem' }}>
                  We believe that dining is not just about the food — it is an atmosphere of elegance, service, and shared moments that linger in the memory.
                </p>
              </Reveal>

              <Reveal delay={150} className="lp-welcome__img-col">
                <div className="lp-welcome__img-card">
                  <img src="/dining-bg.jpg" alt="Fine dining at FamousGate Hotels" />
                  <div className="lp-welcome__badge">
                    <span className="lp-welcome__badge-num">5★</span>
                    <span className="lp-welcome__badge-label">Chef&apos;s Selection</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===== DINING OPTIONS ===== */}
        <section className="lp-experiences" style={{ background: 'var(--warm-white)', paddingBottom: '9rem' }}>
          <div className="lp-container">
            <Reveal className="lp-section-header">
              <p className="lp-eyebrow">Our Venues</p>
              <h2 className="lp-section-title">Discover Our&nbsp;<em>Venues</em></h2>
              <div className="lp-divider" />
            </Reveal>

            <div className="lp-cards">
              {[
                {
                  tag: 'Fine Dining',
                  title: 'Signature Restaurant',
                  desc: 'Experience gourmet cuisine in an elegant setting. Featuring seasonal ingredients and curated wines.',
                  img: '/dining-bg.jpg',
                },
                {
                  tag: 'Casual',
                  title: 'The Lounge & Café',
                  desc: 'Perfect for casual meetings, afternoon tea, or simply unwinding with a premium coffee.',
                  img: '/rooms-bg.jpg',
                },
                {
                  tag: 'Evening',
                  title: 'Bar & Cocktails',
                  desc: 'Enjoy expertly crafted cocktails and premium spirits in our sophisticated bar.',
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
      </main>

      <Footer />
    </>
  );
}
