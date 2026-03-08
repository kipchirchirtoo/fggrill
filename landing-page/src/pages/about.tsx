import Head from 'next/head';
import { Header, Footer } from '@/components/layout';

export default function About() {
  return (
    <>
      <Head>
        <title>About Us - FamousGate Hotels | Luxury Accommodation in Nairobi</title>
        <meta name="description" content="Discover FamousGate Hotels - your premier destination for luxury accommodation in Nairobi, Kenya. Experience world-class hospitality and comfort." />
        <meta name="keywords" content="about famousgate hotels, luxury hotels nairobi, hotel experience kenya, hospitality nairobi" />
        
        {/* Open Graph */}
        <meta property="og:title" content="About Us - FamousGate Hotels" />
        <meta property="og:description" content="Discover FamousGate Hotels - your premier destination for luxury accommodation in Nairobi, Kenya." />
        <meta property="og:url" content="https://famousgatehotels.com/about" />
        
        {/* Twitter Card */}
        <meta name="twitter:title" content="About Us - FamousGate Hotels" />
        <meta name="twitter:description" content="Discover FamousGate Hotels - your premier destination for luxury accommodation in Nairobi, Kenya." />
      </Head>

      <Header />

      <main className="lp-page">
        {/* Hero Section */}
        <section className="lp-about-hero">
          <div className="lp-container">
            <h1 className="lp-about-hero__title">Experience Luxury & Comfort</h1>
            <p className="lp-about-hero__subtitle">
              Where elegance meets exceptional hospitality
            </p>
          </div>
        </section>

        {/* About Content */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-about-content">
              <h2 className="lp-section__title">Welcome to FamousGate Hotels</h2>
              <p className="lp-about-content__text">
                At FamousGate Hotels, we redefine luxury hospitality in Nairobi. Our commitment to excellence 
                ensures every guest experiences unparalleled comfort, world-class amenities, and personalized service 
                that exceeds expectations.
              </p>
              <p className="lp-about-content__text">
                With multiple locations across Nairobi, we offer convenient access to the city's business districts, 
                cultural attractions, and entertainment venues. Each of our hotels is designed to provide a sanctuary 
                of comfort and elegance, whether you're traveling for business or leisure.
              </p>
            </div>

            <div className="lp-features-grid">
              <div className="lp-feature-card">
                <div className="lp-feature-card__icon">🏨</div>
                <h3 className="lp-feature-card__title">Luxury Rooms</h3>
                <p className="lp-feature-card__text">
                  Spacious, elegantly furnished rooms with modern amenities and stunning views.
                </p>
              </div>

              <div className="lp-feature-card">
                <div className="lp-feature-card__icon">🍽️</div>
                <h3 className="lp-feature-card__title">Fine Dining</h3>
                <p className="lp-feature-card__text">
                  Exquisite cuisine prepared by world-class chefs using the finest ingredients.
                </p>
              </div>

              <div className="lp-feature-card">
                <div className="lp-feature-card__icon">🎉</div>
                <h3 className="lp-feature-card__title">Event Spaces</h3>
                <p className="lp-feature-card__text">
                  Versatile venues perfect for weddings, conferences, and special celebrations.
                </p>
              </div>

              <div className="lp-feature-card">
                <div className="lp-feature-card__icon">⭐</div>
                <h3 className="lp-feature-card__title">Premium Service</h3>
                <p className="lp-feature-card__text">
                  24/7 concierge service dedicated to making your stay unforgettable.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx>{`
        .lp-about-hero {
          background: linear-gradient(135deg, #d4af37 0%, #aa8a2e 100%);
          padding: 120px 0 80px;
          text-align: center;
          color: white;
        }

        .lp-about-hero__title {
          font-family: 'Playfair Display', serif;
          font-size: 3.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .lp-about-hero__subtitle {
          font-size: 1.5rem;
          opacity: 0.95;
        }

        .lp-about-content {
          max-width: 800px;
          margin: 0 auto 4rem;
          text-align: center;
        }

        .lp-about-content__text {
          font-size: 1.125rem;
          line-height: 1.8;
          color: #4a5568;
          margin-bottom: 1.5rem;
        }

        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
          margin-top: 3rem;
        }

        .lp-feature-card {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }

        .lp-feature-card__icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .lp-feature-card__title {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: #2d3748;
        }

        .lp-feature-card__text {
          color: #718096;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .lp-about-hero__title {
            font-size: 2.5rem;
          }

          .lp-about-hero__subtitle {
            font-size: 1.25rem;
          }

          .lp-features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
