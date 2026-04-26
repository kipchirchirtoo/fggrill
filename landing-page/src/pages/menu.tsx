import { SEO } from '@/components/SEO';
import Head from 'next/head';
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
      { threshold: 0.08 }
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
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ============================================================
// MENU DATA — from database migration 20260114_menu_overhaul.sql
// ============================================================
const MENU = [
  {
    category: 'Starters / Soups',
    icon: '🥣',
    emoji: '🍲',
    items: [
      { name: 'Mushroom Soup', price: 250 },
      { name: 'Butternut Soup', price: 200 },
      { name: 'Bone Soup (Tumbukiza)', price: 350 },
      { name: 'Beef Stock', price: 50 },
      { name: 'Tomato Soup', price: 200 },
      { name: 'Vegetable Soup', price: 100 },
      { name: 'Soup', price: 100 },
      { name: 'Full Breakfast', price: 1000 },
    ],
  },
  {
    category: 'Salads',
    icon: '🥗',
    emoji: '🥗',
    items: [
      { name: 'Cheese Onions', price: 150 },
      { name: 'Coleslaw Salad', price: 50 },
      { name: 'Guacamole', price: 150 },
      { name: 'Kachumbari', price: 50 },
      { name: "Chef's Salad", price: 100 },
      { name: 'Famous Salad', price: 300 },
    ],
  },
  {
    category: 'Specials',
    icon: '⭐',
    emoji: '🌟',
    items: [
      { name: 'Famous Platter', price: 3500 },
      { name: 'Full Kuku Choma', price: 1500 },
    ],
  },
  {
    category: 'Indian Food',
    icon: '🫓',
    emoji: '🍛',
    items: [
      { name: 'Plain Naan', price: 100 },
      { name: 'Garlic / Butter Naan', price: 150 },
      { name: 'Methi Naan', price: 200 },
      { name: 'Turbo Naan', price: 200 },
      { name: 'Cheese Naan', price: 350 },
      { name: 'Paneer Tikka', price: 800 },
      { name: 'Chicken Tikka', price: 800 },
      { name: 'Mutton Seekh Kebab', price: 850 },
    ],
  },
  {
    category: 'Pasta',
    icon: '🍝',
    emoji: '🍝',
    items: [
      { name: 'Carbonara', price: 700 },
      { name: 'Bolognese', price: 700 },
      { name: 'Napolitana', price: 650 },
      { name: 'Vegetable Pasta', price: 650 },
    ],
  },
  {
    category: 'Pizza',
    icon: '🍕',
    emoji: '🍕',
    items: [
      { name: 'Margherita', price: 900 },
      { name: 'Hawaiian', price: 1000 },
      { name: 'Chicken BBQ', price: 1100 },
      { name: 'Beef BBQ', price: 1100 },
      { name: 'Famous Special', price: 1200 },
    ],
  },
  {
    category: 'Fish',
    icon: '🐟',
    emoji: '🐠',
    items: [
      { name: 'Whole Tilapia', price: 700 },
      { name: 'Fish Fillet', price: 800 },
    ],
  },
  {
    category: 'Steaks',
    icon: '🥩',
    emoji: '🥩',
    items: [
      { name: 'T-Bone Steak', price: 950 },
      { name: 'Sirloin Steak', price: 950 },
      { name: 'Pepper Steak', price: 1000 },
      { name: 'Mushroom Steak', price: 1000 },
    ],
  },
  {
    category: 'Beef',
    icon: '🐄',
    emoji: '🍖',
    items: [
      { name: 'Beef Stew', price: 500 },
      { name: 'Beef Fry', price: 550 },
      { name: 'Wet Fry', price: 600 },
    ],
  },
  {
    category: 'Chicken',
    icon: '🍗',
    emoji: '🍗',
    items: [
      { name: 'Chicken Stew', price: 600 },
      { name: 'Chicken Fry', price: 650 },
      { name: 'Kienyeji Chicken', price: 800 },
    ],
  },
  {
    category: 'Mbuzi (Goat)',
    icon: '🐐',
    emoji: '🐐',
    items: [
      { name: 'Mbuzi Stew', price: 600 },
      { name: 'Mbuzi Fry', price: 650 },
      { name: 'Boiled Mbuzi', price: 600 },
    ],
  },
  {
    category: 'ChomaZone',
    icon: '🔥',
    emoji: '🔥',
    items: [
      { name: '¼ Kuku Choma', price: 400 },
      { name: '½ Kuku Choma', price: 750 },
      { name: 'Full Kuku Choma (CZ)', price: 1400 },
      { name: 'Mbuzi Choma / Kg', price: 1200 },
    ],
  },
  {
    category: 'Accompaniments',
    icon: '🍚',
    emoji: '🍚',
    items: [
      { name: 'Ugali', price: 100 },
      { name: 'Rice', price: 150 },
      { name: 'Chips', price: 200 },
      { name: 'Masala Chips', price: 250 },
      { name: 'Mokimo', price: 250 },
    ],
  },
  {
    category: 'Vegetables',
    icon: '🥬',
    emoji: '🥦',
    items: [
      { name: 'Steamed Vegetables', price: 150 },
      { name: 'Sukuma Wiki', price: 100 },
      { name: 'Cabbage', price: 100 },
    ],
  },
  {
    category: 'Desserts',
    icon: '🍨',
    emoji: '🍦',
    items: [
      { name: 'Fruit Salad', price: 250 },
      { name: 'Assorted Ice Cream', price: 250 },
      { name: 'Fruit Salad with Ice Cream', price: 400 },
    ],
  },
  {
    category: 'Snacks & Bites',
    icon: '🥐',
    emoji: '🥐',
    items: [
      { name: 'Nduma', price: 100 },
      { name: 'Sweet Potatoes', price: 100 },
      { name: 'White Chapati', price: 50 },
      { name: 'Chapati Roll', price: 200 },
      { name: 'Brown Chapati', price: 70 },
      { name: 'Mandazi (3pcs)', price: 50 },
      { name: 'Marble Cake', price: 100 },
      { name: 'Scones (2pcs)', price: 50 },
      { name: 'Queen Cakes (2pcs)', price: 80 },
      { name: 'Swiss Roll', price: 100 },
      { name: 'Croissant (2pcs)', price: 50 },
      { name: 'Tea Scone (2pcs)', price: 100 },
      { name: 'Mahamri', price: 50 },
      { name: 'Pancakes (2pcs)', price: 100 },
      { name: 'Doughnut (2pcs)', price: 50 },
      { name: 'Cookies (3pcs)', price: 100 },
      { name: 'Sweet Corn', price: 100 },
      { name: 'French Toast', price: 100 },
      { name: 'Toast Bread', price: 50 },
      { name: 'Naan Bread', price: 100 },
      { name: 'Boiled Eggs', price: 100 },
      { name: 'Poached Eggs', price: 150 },
      { name: 'Fried Eggs', price: 100 },
      { name: 'Plain Omelet (Broiler)', price: 150 },
      { name: 'Plain Omelet (Kienyeji)', price: 200 },
      { name: 'Spanish Omelet (Broiler)', price: 200 },
      { name: 'Spanish Omelet (Kienyeji)', price: 200 },
      { name: 'Scrambled Eggs (Broiler)', price: 150 },
      { name: 'Scrambled Eggs (Kienyeji)', price: 200 },
      { name: 'Kebab', price: 100 },
      { name: 'Bacon', price: 350 },
      { name: 'Sausages', price: 120 },
      { name: 'Sausage Roll', price: 150 },
      { name: 'Weetabix', price: 100 },
      { name: 'Beef Samosa', price: 120 },
      { name: 'Vegetable Samosa', price: 100 },
      { name: 'Waffles', price: 100 },
    ],
  },
  {
    category: 'Cold Beverages',
    icon: '🥤',
    emoji: '🧃',
    items: [
      { name: 'Mango Juice', price: 200 },
      { name: 'Pineapple Juice', price: 200 },
      { name: 'Cocktail Juice', price: 200 },
      { name: 'Passion Juice', price: 300 },
      { name: 'Beet Root Juice', price: 200 },
      { name: 'Mango Smoothie', price: 300 },
      { name: 'Banana Smoothie', price: 300 },
      { name: 'Fresh Milk', price: 100 },
      { name: 'Mala (Mursik)', price: 100 },
      { name: 'Strawberry Milkshake', price: 300 },
      { name: 'Vanilla Milkshake', price: 300 },
      { name: 'Soda (300ml)', price: 100 },
      { name: 'Soda 500ml (Takeaway)', price: 150 },
      { name: 'Mineral Water (500ml)', price: 50 },
      { name: 'Mineral Water (1 Litre)', price: 100 },
      { name: 'Mineral Water (10 Litres)', price: 500 },
      { name: 'Delmonte', price: 450 },
    ],
  },
  {
    category: 'Hot Beverages',
    icon: '☕',
    emoji: '☕',
    items: [
      { name: 'Tea Mug', price: 50 },
      { name: 'Tea Mug (Takeaway)', price: 100 },
      { name: 'Tea Pot (500ml)', price: 200 },
      { name: 'Tea Flask (1 Litre)', price: 300 },
      { name: 'Tea Flask (2 Litres)', price: 400 },
      { name: 'Tea Flask (3 Litres)', price: 600 },
      { name: 'English Tea (Pot)', price: 200 },
      { name: 'Ginger Tea (Pot)', price: 200 },
      { name: 'Ginger Tea (Mug)', price: 100 },
      { name: 'Tea Masala (500ml)', price: 200 },
      { name: 'Tea Masala (1 Litre)', price: 450 },
      { name: 'Tea Masala (2 Litres)', price: 600 },
      { name: 'Special Tea (500ml)', price: 250 },
      { name: 'Special Tea (1 Litre)', price: 500 },
      { name: 'Special Tea (2 Litres)', price: 800 },
      { name: 'Black Tea', price: 50 },
      { name: 'Green Tea', price: 100 },
      { name: 'Hot Lemon', price: 100 },
      { name: 'Lemon Tea with Honey', price: 150 },
      { name: 'Lemon Tea (500ml)', price: 200 },
      { name: 'Lemon Tea (1 Litre)', price: 350 },
      { name: 'Lemon Tea (2 Litres)', price: 450 },
      { name: 'Hot Lemon with Honey', price: 150 },
      { name: 'Milo (Mug)', price: 100 },
      { name: 'Milo (Takeaway)', price: 200 },
      { name: 'Milo (Tea Pot)', price: 200 },
      { name: 'Hot Chocolate (Mug)', price: 100 },
      { name: 'Hot Chocolate (Takeaway)', price: 200 },
      { name: 'Hot Chocolate (Tea Pot)', price: 300 },
      { name: 'White / Black Coffee Mug', price: 100 },
      { name: 'White Coffee (Takeaway)', price: 200 },
      { name: 'White / Black Coffee (500ml)', price: 200 },
      { name: 'White Coffee (1 Litre)', price: 350 },
      { name: 'White Coffee (2 Litres)', price: 500 },
      { name: 'Lemon Coffee with Honey', price: 150 },
      { name: 'Dawa / Concoction', price: 200 },
      { name: 'Porridge / Uji', price: 100 },
    ],
  },
];

export default function MenuPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { setHeroLoaded(true); }, []);

  const filtered = MENU.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(section =>
    (activeCategory === null || section.category === activeCategory) &&
    section.items.length > 0
  );

  return (
    <>
      <SEO
        title="Restaurant Menu — FamousGate Hotels | Bomet & Kericho, Kenya"
        description="Explore FamousGate Hotels' full menu — from local Kenyan favourites to international cuisine, steaks, pizza, Indian food, beverages, and more. Available at all branches."
        url="https://famousgatehotels.com/menu"
        breadcrumbs={[{ name: 'Menu', item: '/menu' }]}
      />
      <Head>
        <meta name="keywords" content="famousgate menu, restaurant menu Bomet, hotel food menu Kenya, FamousGate restaurant, Kenyan cuisine, pizza Bomet, kuku choma Kenya" />
      </Head>

      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/dining-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            {/* Logo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <img src="/logo_official.png" alt="FamousGate Hotels Logo" style={{ height: '80px', width: 'auto', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
            </div>
            <p className="lp-hero__eyebrow">Bomet & Kericho, Kenya</p>
            <h1 className="lp-hero__title">
              Our Restaurant<br />
              <em>Menu</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              From local Kenyan favourites to international delights — crafted with passion, served with excellence.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== MENU BODY ===== */}
        <section className="menu-section">
          <div className="lp-container">

            {/* Search & Filter Bar */}
            <Reveal className="menu-controls">
              <div className="menu-search-wrap">
                <span className="menu-search-icon">🔍</span>
                <input
                  id="menu-search"
                  className="menu-search"
                  type="text"
                  placeholder="Search menu items..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="menu-cats">
                <button
                  className={`menu-cat-btn${activeCategory === null ? ' active' : ''}`}
                  onClick={() => setActiveCategory(null)}
                >
                  All
                </button>
                {MENU.map(s => (
                  <button
                    key={s.category}
                    className={`menu-cat-btn${activeCategory === s.category ? ' active' : ''}`}
                    onClick={() => setActiveCategory(activeCategory === s.category ? null : s.category)}
                  >
                    {s.icon} {s.category}
                  </button>
                ))}
              </div>
            </Reveal>

            {/* Menu Grid */}
            {filtered.map((section, si) => (
              <Reveal key={section.category} delay={si * 50} className="menu-cat-block">
                <div className="menu-cat-header">
                  <span className="menu-cat-emoji">{section.emoji}</span>
                  <h2 className="menu-cat-title">{section.category}</h2>
                </div>
                <div className="menu-items-grid">
                  {section.items.map((item, ii) => (
                    <Reveal key={item.name} delay={ii * 30} className="menu-item">
                      <span className="menu-item__name">{item.name}</span>
                      <span className="menu-item__dots" />
                      <span className="menu-item__price">KES {item.price.toLocaleString()}</span>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            ))}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--gold)' }}>
                <p style={{ fontSize: '3rem' }}>🍽️</p>
                <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>No items match your search.</p>
              </div>
            )}

          </div>
        </section>

        {/* ===== FOOTER NOTE ===== */}
        <div className="menu-footer-note">
          <div className="lp-container" style={{ textAlign: 'center' }}>
            <img src="/logo_official.png" alt="FamousGate Hotels" style={{ height: '60px', marginBottom: '1.5rem', filter: 'brightness(0) invert(1) opacity(0.8)' }} />
            <p>All prices are in <strong>Kenya Shillings (KES)</strong> and inclusive of taxes.</p>
            <p>Menu items and prices may vary by branch. Ask our team for daily specials.</p>
            <p style={{ marginTop: '0.75rem', opacity: 0.6, fontSize: '0.85rem' }}>
              Kyogong · Litein · Mogogoshiek · Sotik — Bomet & Kericho, Kenya
            </p>
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        .menu-section {
          background: var(--warm-white);
          padding: 5rem 0 7rem;
        }
        .menu-controls {
          margin-bottom: 3.5rem;
        }
        .menu-search-wrap {
          position: relative;
          max-width: 480px;
          margin: 0 auto 2rem;
        }
        .menu-search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
        }
        .menu-search {
          width: 100%;
          padding: 1rem 1rem 1rem 3rem;
          border: 2px solid rgba(184,149,90,0.3);
          border-radius: 50px;
          font-family: var(--font-body);
          font-size: 1rem;
          background: white;
          color: var(--charcoal);
          outline: none;
          transition: border-color 0.2s;
        }
        .menu-search:focus { border-color: var(--gold); }
        .menu-cats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }
        .menu-cat-btn {
          padding: 0.45rem 1.1rem;
          border-radius: 50px;
          border: 1.5px solid rgba(184,149,90,0.4);
          background: white;
          color: var(--charcoal);
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .menu-cat-btn:hover, .menu-cat-btn.active {
          background: var(--gold);
          color: white;
          border-color: var(--gold);
        }

        .menu-cat-block {
          margin-bottom: 3.5rem;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
        }
        .menu-cat-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem 2rem;
          background: linear-gradient(90deg, var(--gold), #c9a96e);
          color: white;
        }
        .menu-cat-emoji { font-size: 1.8rem; }
        .menu-cat-title {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
          letter-spacing: 0.04em;
        }
        .menu-items-grid {
          padding: 1.5rem 2rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 0;
        }
        .menu-item {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          padding: 0.7rem 0;
          border-bottom: 1px dashed rgba(184,149,90,0.18);
        }
        .menu-item:last-child { border-bottom: none; }
        .menu-item__name {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--charcoal);
          font-weight: 500;
          flex-shrink: 0;
        }
        .menu-item__dots {
          flex: 1;
          height: 1px;
          border-bottom: 1px dotted rgba(0,0,0,0.15);
          min-width: 20px;
          margin: 0 0.5rem;
          position: relative;
          top: -4px;
        }
        .menu-item__price {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--gold);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .menu-footer-note {
          background: var(--charcoal);
          color: rgba(255,255,255,0.75);
          padding: 4rem 2rem;
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 2;
        }

        @media (max-width: 640px) {
          .menu-items-grid { grid-template-columns: 1fr; padding: 1rem 1.5rem; }
          .menu-cat-header { padding: 1.2rem 1.5rem; }
        }
      `}</style>
    </>
  );
}
