# Layout Components

This directory contains the reusable layout components for the FamousGate Hotels Landing Page.

## Components

### Header

The main navigation header component with responsive design.

**Features:**
- Fixed position navigation that becomes sticky on scroll
- Logo and brand text
- Desktop navigation menu
- Mobile hamburger menu
- "Book Your Stay" CTA button
- Responsive breakpoints for mobile, tablet, and desktop

**Usage:**
```tsx
import { Header } from '@/components/layout';

<Header />
```

**Props:**
- `className?: string` - Optional additional CSS classes

### Footer

The site footer with contact information, links, and social media.

**Features:**
- Contact information (phone, email, address)
- Business hours
- Navigation links
- Social media links (Instagram, Facebook, Twitter)
- Copyright and legal links
- Responsive grid layout

**Usage:**
```tsx
import { Footer } from '@/components/layout';

<Footer />
```

**Props:**
- `className?: string` - Optional additional CSS classes

### Navigation

Reusable navigation components for menu items.

**Components:**
- `Navigation` - Desktop navigation menu
- `MobileMenu` - Full-screen mobile menu overlay
- `HamburgerButton` - Animated hamburger menu button

**Usage:**
```tsx
import { Navigation, MobileMenu, HamburgerButton } from '@/components/layout';

// Desktop navigation
<Navigation 
  items={[
    { label: 'Home', href: '#home' },
    { label: 'About', href: '#about' }
  ]}
/>

// Mobile menu
<MobileMenu
  items={[...]}
  ctaLabel="Book Now"
  ctaHref="#booking"
  isOpen={menuOpen}
  onClose={() => setMenuOpen(false)}
/>

// Hamburger button
<HamburgerButton
  isOpen={menuOpen}
  onClick={() => setMenuOpen(!menuOpen)}
/>
```

## Responsive Design

All layout components are fully responsive and follow these breakpoints:

- **Mobile**: < 768px - Hamburger menu, stacked layout
- **Tablet**: 768px - 1024px - Adjusted spacing and sizing
- **Desktop**: > 1024px - Full navigation menu, multi-column footer

## Accessibility

All components include:
- Proper ARIA labels and attributes
- Keyboard navigation support
- Focus indicators
- Semantic HTML structure
- Screen reader friendly text

## Styling

Components use the existing CSS classes from `globals.css`:
- `.lp-nav` - Navigation styles
- `.lp-footer` - Footer styles
- `.lp-mobile-menu` - Mobile menu styles

All styles support the luxury hotel brand aesthetic with gold accents and elegant typography.

## Requirements Satisfied

- **Requirement 3.2**: Display contact information (phone, email, address, social media)
- **Requirement 7.2**: Responsive design for all screen sizes (320px - 2560px)
- Mobile hamburger menu for small screens
- Click-to-call and click-to-email functionality
- Business hours display
