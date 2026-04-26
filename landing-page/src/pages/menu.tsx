import { SEO } from '@/components/SEO';
import { Header, Footer } from '@/components/layout';
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
      { threshold: 0.05 }
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
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms, transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ============================================================
// MENU DATA
// ============================================================
const MENU_SECTIONS = [
  {
    title: 'Starters & Soups',
    items: [
      { name: 'Mushroom Soup', price: 250, desc: 'Creamy woodland mushrooms infused with thyme' },
      { name: 'Butternut Soup', price: 200, desc: 'Roasted squash with a hint of nutmeg and ginger' },
      { name: 'Bone Soup (Tumbukiza)', price: 350, desc: 'Traditional slow-boiled beef stock with marrow' },
      { name: 'Famous Salad', price: 300, desc: 'Chef\'s signature garden greens with house dressing' },
      { name: 'Full Breakfast', price: 1000, desc: 'The complete FamousGate morning experience' },
    ],
  },
  {
    title: 'Chef\'s Specials',
    items: [
      { name: 'Famous Platter', price: 3500, desc: 'An abundant selection of our finest meats and sides' },
      { name: 'Full Kuku Choma', price: 1500, desc: 'Whole flame-grilled chicken with traditional spices' },
      { name: 'Mbuzi Choma / Kg', price: 1200, desc: 'Slow-roasted goat meat, tender and smoky' },
    ],
  },
  {
    title: 'Italian Selection',
    items: [
      { name: 'Famous Special Pizza', price: 1200, desc: 'Our premium combination of artisanal toppings' },
      { name: 'Chicken BBQ Pizza', price: 1100, desc: 'Tender chicken with smoky hickory sauce' },
      { name: 'Pasta Carbonara', price: 700, desc: 'Silky cream sauce with pancetta and parmesan' },
      { name: 'Napolitana Pasta', price: 650, desc: 'Classic slow-cooked tomato and basil sauce' },
    ],
  },
  {
    title: 'Main Cuisine',
    items: [
      { name: 'T-Bone Steak', price: 950, desc: 'Prime cut grilled to your preference' },
      { name: 'Sirloin Steak', price: 950, desc: 'Tender aged beef with garlic herb butter' },
      { name: 'Fish Fillet', price: 800, desc: 'Pan-seared lake Victoria tilapia with lemon' },
      { name: 'Kienyeji Chicken', price: 800, desc: 'Traditional free-range chicken stew' },
      { name: 'Mbuzi Fry', price: 650, desc: 'Sautéed goat meat with onions and coriander' },
    ],
  },
  {
    title: 'Indian Delicacies',
    items: [
      { name: 'Chicken Tikka', price: 800, desc: 'Yoghurt marinated chicken from the clay oven' },
      { name: 'Paneer Tikka', price: 800, desc: 'Grilled artisanal cottage cheese with spices' },
      { name: 'Garlic / Butter Naan', price: 150, desc: 'Freshly baked tandoori flatbread' },
      { name: 'Cheese Naan', price: 350, desc: 'Naan stuffed with melted mozzarella' },
    ],
  },
  {
    title: 'Accompaniments',
    items: [
      { name: 'Masala Chips', price: 250, desc: 'Hand-cut fries tossed in spicy tomato glaze' },
      { name: 'Mokimo', price: 250, desc: 'Traditional mashed potatoes with maize and greens' },
      { name: 'Ugali', price: 100, desc: 'Traditional Kenyan white maize meal' },
      { name: 'Rice', price: 150, desc: 'Fragrant steamed long-grain basmati' },
    ],
  },
  {
    title: 'Beverages',
    items: [
      { name: 'Fresh Mango Smoothie', price: 300, desc: 'Sun-ripened Bomet mangoes blended cold' },
      { name: 'Vanilla Milkshake', price: 300, desc: 'Rich Madagascar vanilla bean cream' },
      { name: 'Special Tea (Pot)', price: 250, desc: 'FamousGate signature blend from local estates' },
      { name: 'Dawa / Concoction', price: 200, desc: 'Lemon, ginger, and honey immunity booster' },
    ],
  },
];

export default function MenuPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => { setHeroLoaded(true); }, []);

  return (
    <>
      <SEO
        title="The Menu — FamousGate Hotels | Culinary Excellence"
        description="Experience the finest culinary journey in Bomet and Kericho. Explore our curated menu of local favourites and international classics."
        url="https://famousgatehotels.com/menu"
        breadcrumbs={[{ name: 'Menu', item: '/menu' }]}
      />

      <Header hideLogo />

      <main className="menu-page">
        {/* ===== MINIMALIST HERO ===== */}
        <section className="menu-hero">
          <div className="menu-hero__overlay" />
          <div suppressHydrationWarning className={`menu-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <span className="menu-hero__eyebrow">Culinary Excellence</span>
            <h1 className="menu-hero__title">The Menu</h1>
            <div className="menu-hero__line" />
            <p className="menu-hero__desc">A curated selection of seasonal ingredients and traditional flavours</p>
          </div>
        </section>

        {/* ===== MENU CONTENT ===== */}
        <section className="menu-body">
          <div className="menu-container">
            
            <div className="menu-grid">
              {MENU_SECTIONS.map((section, idx) => (
                <div key={section.title} className="menu-section">
                  <div className="menu-items">
                    {section.items.map((item, iidx) => (
                      <Reveal key={item.name} delay={(idx * 50) + (iidx * 30)}>
                        <div className="menu-item">
                          <div className="menu-item__header">
                            <h3 className="menu-item__name">{item.name}</h3>
                            <div className="menu-item__dots" />
                            <span className="menu-item__price">{item.price.toLocaleString()}</span>
                          </div>
                          {item.desc && <p className="menu-item__desc">{item.desc}</p>}
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* FINALE */}
            <Reveal delay={400}>
              <div className="menu-footer">
                <div className="menu-footer__line" />
                <p className="menu-footer__text">
                  Prices are in Kenya Shillings (KES) inclusive of 16% VAT.<br />
                  Please inform your server of any dietary requirements or allergies.
                </p>
                <div className="menu-footer__locations">
                  Kyogong · Litein · Mogogoshiek · Sotik
                </div>
              </div>
            </Reveal>

          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        :root {
          --menu-bg: #fcfbf7;
          --menu-text: #1a1a1a;
          --menu-gold: #b8955a;
          --menu-muted: #666;
          --menu-border: rgba(26,26,26,0.1);
        }

        .menu-page {
          background-color: var(--menu-bg);
          color: var(--menu-text);
        }

        /* Hero */
        .menu-hero {
          height: 60vh;
          min-height: 450px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: url('/hero-bg.jpg') center/cover no-repeat fixed;
          position: relative;
        }
        .menu-hero__overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.55);
        }
        .menu-hero__content {
          position: relative;
          z-index: 10;
          opacity: 0;
          transform: translateY(20px);
          transition: all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .menu-hero__content.loaded {
          opacity: 1;
          transform: translateY(0);
        }
        .menu-hero__eyebrow {
          display: block;
          font-family: var(--font-body);
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: var(--menu-gold);
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
        }
        .menu-hero__title {
          font-family: var(--font-display);
          font-size: clamp(3.5rem, 8vw, 5.5rem);
          color: white;
          font-weight: 300;
          margin: 0;
        }
        .menu-hero__line {
          width: 60px;
          height: 1px;
          background: var(--menu-gold);
          margin: 2rem auto;
        }
        .menu-hero__desc {
          font-family: var(--font-display);
          color: rgba(255,255,255,0.8);
          font-size: 1.25rem;
          font-style: italic;
          max-width: 500px;
          margin: 0 auto;
        }

        /* Body */
        .menu-body {
          padding: 8rem 0 10rem;
        }
        .menu-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4rem 6rem;
        }

        .menu-section {
          padding-bottom: 2rem;
        }

        .menu-items {
          display: flex;
          flex-direction: column;
          gap: 3rem;
        }

        .menu-item__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.75rem;
          gap: 1rem;
        }
        .menu-item__name {
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 400;
          margin: 0;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .menu-item__dots {
          flex: 1;
          border-bottom: 1px dotted var(--menu-border);
          position: relative;
          top: -4px;
        }
        .menu-item__price {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          color: var(--menu-gold);
          letter-spacing: 0.05em;
        }
        .menu-item__desc {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--menu-muted);
          line-height: 1.6;
          font-style: italic;
          font-weight: 300;
        }

        /* Footer */
        .menu-footer {
          margin-top: 10rem;
          text-align: center;
        }
        .menu-footer__line {
          width: 100%;
          height: 1px;
          background: var(--menu-border);
          margin-bottom: 4rem;
        }
        .menu-footer__text {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--menu-muted);
          line-height: 1.8;
        }
        .menu-footer__locations {
          margin-top: 2rem;
          font-family: var(--font-body);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.75rem;
          color: var(--menu-gold);
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .menu-grid { grid-template-columns: 1fr; gap: 5rem; }
          .menu-item__desc { max-width: 100%; }
        }
        @media (max-width: 640px) {
          .menu-body { padding: 5rem 0 6rem; }
          .menu-hero { height: 50vh; }
          .menu-hero__title { font-size: 3rem; }
        }
      `}</style>
    </>
  );
}
