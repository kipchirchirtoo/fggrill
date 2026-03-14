import { SEO } from '@/components/SEO';
import Head from 'next/head';
import { Header, Footer } from '@/components/layout';

export default function Events() {
  return (
    <>
      <SEO
        title="Events & Conferences - FamousGate Hotels | Nairobi Event Venues"
        description="Host your events at FamousGate Hotels. We offer versatile venues for weddings, conferences, meetings, and celebrations in Nairobi."
        url="https://famousgatehotels.com/events"
        breadcrumbs={[
          { name: "Events", item: "/events" }
        ]}
        schemaList={[
          JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EventVenue",
            "name": "FamousGate Hotels Events",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Nairobi",
              "addressCountry": "KE"
            }
          })
        ]}
      />
      <Head>
        <meta name="keywords" content="event venues nairobi, conference halls kenya, wedding venues nairobi, meeting rooms famousgate" />
      </Head>

      <Header />

      <main className="lp-page">
        {/* Hero Section */}
        <section className="lp-events-hero">
          <div className="lp-container">
            <h1 className="lp-events-hero__title">Unforgettable Events</h1>
            <p className="lp-events-hero__subtitle">
              Perfect venues for every occasion
            </p>
          </div>
        </section>

        {/* Events Content */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-events-intro">
              <h2 className="lp-section__title">Your Vision, Our Expertise</h2>
              <p className="lp-events-intro__text">
                From intimate gatherings to grand celebrations, FamousGate Hotels provides the perfect setting for your special events.
                Our experienced team ensures every detail is flawlessly executed, creating memories that last a lifetime.
              </p>
            </div>

            <div className="lp-events-grid">
              <div className="lp-event-card">
                <div className="lp-event-card__icon">💍</div>
                <h3 className="lp-event-card__title">Weddings</h3>
                <p className="lp-event-card__text">
                  Celebrate your special day in elegant surroundings. Our wedding packages include everything you need
                  for a perfect celebration, from ceremony to reception.
                </p>
                <ul className="lp-event-card__features">
                  <li>Elegant Ballrooms</li>
                  <li>Outdoor Garden Venues</li>
                  <li>Customized Menus</li>
                  <li>Wedding Coordinator</li>
                  <li>Bridal Suite</li>
                </ul>
              </div>

              <div className="lp-event-card">
                <div className="lp-event-card__icon">🎤</div>
                <h3 className="lp-event-card__title">Conferences</h3>
                <p className="lp-event-card__text">
                  State-of-the-art conference facilities equipped with modern technology. Perfect for corporate events,
                  seminars, and business meetings of any size.
                </p>
                <ul className="lp-event-card__features">
                  <li>High-Speed WiFi</li>
                  <li>AV Equipment</li>
                  <li>Flexible Seating</li>
                  <li>Catering Services</li>
                  <li>Business Center</li>
                </ul>
              </div>

              <div className="lp-event-card">
                <div className="lp-event-card__icon">🎉</div>
                <h3 className="lp-event-card__title">Private Parties</h3>
                <p className="lp-event-card__text">
                  Host memorable celebrations in our versatile event spaces. From birthdays to anniversaries,
                  we create the perfect atmosphere for your special occasion.
                </p>
                <ul className="lp-event-card__features">
                  <li>Customizable Spaces</li>
                  <li>Themed Decorations</li>
                  <li>Entertainment Options</li>
                  <li>Custom Catering</li>
                  <li>Event Planning</li>
                </ul>
              </div>

              <div className="lp-event-card">
                <div className="lp-event-card__icon">🤝</div>
                <h3 className="lp-event-card__title">Corporate Meetings</h3>
                <p className="lp-event-card__text">
                  Professional meeting rooms designed for productivity. Ideal for board meetings, training sessions,
                  and team building events.
                </p>
                <ul className="lp-event-card__features">
                  <li>Private Meeting Rooms</li>
                  <li>Presentation Equipment</li>
                  <li>Coffee & Refreshments</li>
                  <li>Secretarial Services</li>
                  <li>Parking Available</li>
                </ul>
              </div>
            </div>

            {/* Contact CTA */}
            <div className="lp-events-cta">
              <h3 className="lp-events-cta__title">Ready to Plan Your Event?</h3>
              <p className="lp-events-cta__text">
                Contact our events team to discuss your requirements and receive a customized proposal.
              </p>
              <a href="mailto:famousgatesbmt@gmail.com" className="lp-events-cta__button">
                Get in Touch
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        .lp-events-hero {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 120px 0 80px;
          text-align: center;
          color: white;
        }

        .lp-events-hero__title {
          font-family: 'Playfair Display', serif;
          font-size: 3.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .lp-events-hero__subtitle {
          font-size: 1.5rem;
          opacity: 0.95;
        }

        .lp-events-intro {
          max-width: 800px;
          margin: 0 auto 4rem;
          text-align: center;
        }

        .lp-events-intro__text {
          font-size: 1.125rem;
          line-height: 1.8;
          color: #4a5568;
        }

        .lp-events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
          margin-top: 3rem;
        }

        .lp-event-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-event-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }

        .lp-event-card__icon {
          font-size: 4rem;
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .lp-event-card__title {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #2d3748;
        }

        .lp-event-card__text {
          color: #718096;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .lp-event-card__features {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .lp-event-card__features li {
          padding: 0.5rem 0;
          color: #4a5568;
          font-size: 0.95rem;
        }

        .lp-event-card__features li::before {
          content: '✓ ';
          color: #667eea;
          font-weight: bold;
          margin-right: 0.5rem;
        }

        .lp-events-cta {
          margin-top: 5rem;
          text-align: center;
          padding: 3rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
        }

        .lp-events-cta__title {
          font-family: 'Playfair Display', serif;
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .lp-events-cta__text {
          font-size: 1.25rem;
          margin-bottom: 2rem;
          opacity: 0.95;
        }

        .lp-events-cta__button {
          display: inline-block;
          padding: 1rem 2.5rem;
          background: white;
          color: #667eea;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-events-cta__button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
          .lp-events-hero__title {
            font-size: 2.5rem;
          }

          .lp-events-hero__subtitle {
            font-size: 1.25rem;
          }

          .lp-events-grid {
            grid-template-columns: 1fr;
          }

          .lp-events-cta__title {
            font-size: 2rem;
          }
        }
      `}</style>
    </>
  );
}
