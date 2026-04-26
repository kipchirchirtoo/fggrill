import { useState, useEffect } from 'react';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const [currentYear, setCurrentYear] = useState(2024);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className={`lp-footer ${className}`}>
      <div className="lp-container">
        <div className="lp-footer__top">
          {/* Brand */}
          <div className="lp-footer__brand">
            <div className="lp-footer__logo">
              <span className="lp-nav__brand-fg">FAMOUSGATE</span>
              <span className="lp-nav__brand-grill">HOTELS</span>
            </div>
            <p className="lp-footer__tagline">
              Where luxury meets exceptional comfort. A sanctuary for every occasion.
            </p>
            <div className="lp-footer__socials">
              <a
                href="https://www.instagram.com/famousgateshotel/"
                className="lp-footer__social"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@famousgateshotel"
                className="lp-footer__social"
                aria-label="TikTok"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a
                href="https://facebook.com/famousgateshotels"
                className="lp-footer__social"
                aria-label="Facebook"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://twitter.com/famousgateshotels"
                className="lp-footer__social"
                aria-label="Twitter"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="lp-footer__links">
            <div className="lp-footer__col">
              <h4 className="lp-footer__heading">Explore</h4>
              <ul className="lp-footer__list">
                <li><a href="/about">About Us</a></li>
                <li><a href="/rooms">Rooms & Suites</a></li>
                <li><a href="/restaurant">FG Grill Restaurant</a></li>
                <li><a href="/conferences">Conferences</a></li>
                <li><a href="/gallery">Photo Gallery</a></li>
              </ul>
            </div>

            <div className="lp-footer__col">
              <h4 className="lp-footer__heading">Services</h4>
              <ul className="lp-footer__list">
                <li><a href="/book">Book a Room</a></li>
                <li><a href="/restaurant/menu">View Menu</a></li>
                <li><a href="/contact">Event Inquiry</a></li>
                <li><a href="/contact">Support</a></li>
              </ul>
            </div>

            <div className="lp-footer__col">
              <h4 className="lp-footer__heading">Contact</h4>
              <ul className="lp-footer__list">
                <li>
                  <a href="tel:+254706782828">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    +254 706 782 828
                  </a>
                </li>
                <li>
                  <a href="mailto:info@famousgates.com">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    info@famousgates.com
                  </a>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Ngong Road, Nairobi
                </li>
              </ul>
            </div>

            <div className="lp-footer__col">
              <h4 className="lp-footer__heading">Hours</h4>
              <ul className="lp-footer__list">
                <li>Hotel: 24/7</li>
                <li>FG Grill: 7 AM - 11 PM</li>
                <li>Reception: 24/7</li>
              </ul>
            </div>
          </div>

        </div>

        <div className="lp-footer__bottom">
          <p className="lp-footer__copyright">
            © {currentYear} FamousGate Hotels. All rights reserved.
          </p>
          <div className="lp-footer__legal">
            <a href="#privacy">Privacy Policy</a>
            <span className="lp-footer__separator">·</span>
            <a href="#terms">Terms of Service</a>
            <span className="lp-footer__separator">·</span>
            <a href="#cookies">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
