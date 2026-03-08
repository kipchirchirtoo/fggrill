interface NavigationProps {
  items: Array<{
    label: string;
    href: string;
  }>;
  className?: string;
  onLinkClick?: () => void;
}

/**
 * Navigation component for desktop and mobile menu items
 * Used within Header component for consistent navigation across the site
 */
export default function Navigation({ items, className = '', onLinkClick }: NavigationProps) {
  return (
    <ul className={`lp-nav__links ${className}`}>
      {items.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
            className="lp-nav__link"
            onClick={onLinkClick}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

interface MobileMenuProps {
  items: Array<{
    label: string;
    href: string;
  }>;
  ctaLabel?: string;
  ctaHref?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile menu component with hamburger navigation
 * Displays full-screen overlay menu on mobile devices
 */
export function MobileMenu({ items, ctaLabel, ctaHref, isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) return null;

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <div className="lp-mobile-menu">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="lp-mobile-menu__link"
          onClick={handleLinkClick}
        >
          {item.label}
        </a>
      ))}
      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="lp-mobile-menu__cta"
          onClick={handleLinkClick}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}

interface HamburgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Hamburger menu button for mobile navigation
 * Animates between hamburger and X icon
 */
export function HamburgerButton({ isOpen, onClick, className = '' }: HamburgerButtonProps) {
  return (
    <button
      className={`lp-nav__hamburger${isOpen ? ' open' : ''} ${className}`}
      onClick={onClick}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <span />
      <span />
      <span />
    </button>
  );
}
