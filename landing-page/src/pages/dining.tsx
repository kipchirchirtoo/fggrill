import Head from 'next/head';
import { Header, Footer } from '@/components/layout';

export default function Dining() {
  return (
    <>
      <Head>
        <title>Dining - FamousGate Hotels | Fine Dining in Nairobi</title>
        <meta name="description" content="Experience exquisite cuisine at FamousGate Hotels. Our restaurants offer fine dining with local and international flavors in elegant settings." />
        <meta name="keywords" content="fine dining nairobi, restaurant famousgate, hotel dining kenya, luxury restaurant nairobi" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Dining - FamousGate Hotels" />
        <meta property="og:description" content="Experience exquisite cuisine at FamousGate Hotels. Fine dining with local and international flavors." />
        <meta property="og:url" content="https://famousgatehotels.com/dining" />
        
        {/* Twitter Card */}
        <meta name="twitter:title" content="Dining - FamousGate Hotels" />
        <meta name="twitter:description" content="Experience exquisite cuisine at FamousGate Hotels. Fine dining with local and international flavors." />
      </Head>

      <Header />

      <main className="lp-page">
        {/* Hero Section */}
        <section className="lp-dining-hero">
          <div className="lp-container">
            <h1 className="lp-dining-hero__title">Culinary Excellence</h1>
            <p className="lp-dining-hero__subtitle">
              Savor the finest flavors from around the world
            </p>
          </div>
        </section>

        {/* Dining Content */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-dining-intro">
              <h2 className="lp-section__title">A Feast for the Senses</h2>
              <p className="lp-dining-intro__text">
                Our restaurants combine exceptional cuisine with elegant ambiance, creating unforgettable dining experiences. 
                From traditional Kenyan dishes to international favorites, every meal is crafted with passion and precision.
              </p>
            </div>

            <div className="lp-dining-grid">
              <div className="lp-dining-card">
                <div className="lp-dining-card__image">🍽️</div>
                <h3 className="lp-dining-card__title">Fine Dining Restaurant</h3>
                <p className="lp-dining-card__text">
                  Experience gourmet cuisine in an elegant setting. Our signature restaurant offers a carefully curated menu 
                  featuring the finest local and international ingredients.
                </p>
                <ul className="lp-dining-card__features">
                  <li>International & Local Cuisine</li>
                  <li>Wine Selection</li>
                  <li>Private Dining Available</li>
                </ul>
              </div>

              <div className="lp-dining-card">
                <div className="lp-dining-card__image">☕</div>
                <h3 className="lp-dining-card__title">Café & Lounge</h3>
                <p className="lp-dining-card__text">
                  Relax in our comfortable café and lounge area. Perfect for casual meetings, afternoon tea, 
                  or simply unwinding with a premium coffee.
                </p>
                <ul className="lp-dining-card__features">
                  <li>Specialty Coffee & Tea</li>
                  <li>Light Meals & Pastries</li>
                  <li>All-Day Service</li>
                </ul>
              </div>

              <div className="lp-dining-card">
                <div className="lp-dining-card__image">🍹</div>
                <h3 className="lp-dining-card__title">Bar & Cocktails</h3>
                <p className="lp-dining-card__text">
                  Enjoy expertly crafted cocktails and premium spirits in our sophisticated bar. 
                  The perfect spot for evening drinks and socializing.
                </p>
                <ul className="lp-dining-card__features">
                  <li>Signature Cocktails</li>
                  <li>Premium Spirits</li>
                  <li>Live Entertainment</li>
                </ul>
              </div>

              <div className="lp-dining-card">
                <div className="lp-dining-card__image">🥘</div>
                <h3 className="lp-dining-card__title">Room Service</h3>
                <p className="lp-dining-card__text">
                  Enjoy our full menu from the comfort of your room. Our 24-hour room service ensures 
                  you can dine whenever you desire.
                </p>
                <ul className="lp-dining-card__features">
                  <li>24/7 Availability</li>
                  <li>Full Menu Selection</li>
                  <li>In-Room Dining Experience</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx>{`
        .lp-dining-hero {
          background: linear-gradient(135deg, #8b4513 0%, #654321 100%);
          padding: 120px 0 80px;
          text-align: center;
          color: white;
        }

        .lp-dining-hero__title {
          font-family: 'Playfair Display', serif;
          font-size: 3.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .lp-dining-hero__subtitle {
          font-size: 1.5rem;
          opacity: 0.95;
        }

        .lp-dining-intro {
          max-width: 800px;
          margin: 0 auto 4rem;
          text-align: center;
        }

        .lp-dining-intro__text {
          font-size: 1.125rem;
          line-height: 1.8;
          color: #4a5568;
        }

        .lp-dining-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
          margin-top: 3rem;
        }

        .lp-dining-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-dining-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }

        .lp-dining-card__image {
          font-size: 4rem;
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .lp-dining-card__title {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #2d3748;
        }

        .lp-dining-card__text {
          color: #718096;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .lp-dining-card__features {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .lp-dining-card__features li {
          padding: 0.5rem 0;
          color: #4a5568;
          border-bottom: 1px solid #e2e8f0;
        }

        .lp-dining-card__features li:last-child {
          border-bottom: none;
        }

        .lp-dining-card__features li::before {
          content: '✓ ';
          color: #d4af37;
          font-weight: bold;
          margin-right: 0.5rem;
        }

        @media (max-width: 768px) {
          .lp-dining-hero__title {
            font-size: 2.5rem;
          }

          .lp-dining-hero__subtitle {
            font-size: 1.25rem;
          }

          .lp-dining-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
