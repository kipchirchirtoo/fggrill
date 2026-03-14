import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HeaderProps {
  className?: string;
}

export default function Header({ className = '' }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu when clicking on a link
  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  const navItems = [
    { label: 'About', href: '/about' },
    { label: 'Dining', href: '/dining' },
    { label: 'Events', href: '/events' },
    { label: 'Hotels', href: '/hotels' },
    { label: 'Reservations', href: '/#reservations' },
  ];

  return (
    <header className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''} ${className}`}>
      <div className="lp-nav__inner">
        {/* Brand */}
        <Link href="/" className="lp-nav__brand">
          <img src="/fglogo.png" alt="FamousGate Logo" className="lp-nav__logo" />
          <div className="lp-nav__brand-text">
            <span className="lp-nav__brand-fg">FAMOUSGATE</span>
            <span className="lp-nav__brand-grill">HOTELS</span>
          </div>
        </Link>

        {/* Desktop links */}
        <nav aria-label="Main Navigation">
          <ul className="lp-nav__links">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="lp-nav__link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA */}
        <Link href="/#reservations" className="lp-nav__cta">
          Book Your Stay
        </Link>

        {/* Hamburger */}
        <button
          className={`lp-nav__hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lp-mobile-menu">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="lp-mobile-menu__link"
              onClick={handleLinkClick}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#reservations"
            className="lp-mobile-menu__cta"
            onClick={handleLinkClick}
          >
            Book Your Stay
          </Link>
        </div>
      )}
    </header>
  );
}
