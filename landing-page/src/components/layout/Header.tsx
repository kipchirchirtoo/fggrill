import { useState, useEffect } from 'react';

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

  return (
    <nav className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''} ${className}`}>
      <div className="lp-nav__inner">
        {/* Brand */}
        <a href="#top" className="lp-nav__brand">
          <img src="/fglogo.png" alt="FamousGate Logo" className="lp-nav__logo" />
          <div className="lp-nav__brand-text">
            <span className="lp-nav__brand-fg">FAMOUSGATE</span>
            <span className="lp-nav__brand-grill">HOTELS</span>
          </div>
        </a>

        {/* Desktop links */}
        <ul className="lp-nav__links">
          {['Experience', 'Dining', 'Events', 'Branches', 'Reservations'].map((item) => (
            <li key={item}>
              <a href={`#${item.toLowerCase()}`} className="lp-nav__link">
                {item}
              </a>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a href="#reservations" className="lp-nav__cta">
          Book Your Stay
        </a>

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
          {['Experience', 'Dining', 'Events', 'Branches', 'Reservations'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="lp-mobile-menu__link"
              onClick={handleLinkClick}
            >
              {item}
            </a>
          ))}
          <a
            href="#reservations"
            className="lp-mobile-menu__cta"
            onClick={handleLinkClick}
          >
            Book Your Stay
          </a>
        </div>
      )}
    </nav>
  );
}
