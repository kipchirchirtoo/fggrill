# Implementation Plan: FamousGates Hotels Landing Page

## Overview

This implementation plan creates a standalone, independently deployable landing page for FamousGates Hotels. The landing page will be built in a separate `landing-page/` directory using Next.js with TypeScript, completely independent from the main hotel management system. It will integrate with the main system through REST API endpoints for hotel data, room availability, and booking functionality.

## Tasks

- [x] 1. Set up independent landing page project structure
  - Create `landing-page/` directory at repository root (separate from main system)
  - Initialize Next.js project with TypeScript configuration
  - Set up package.json with dependencies (React, Next.js, React Query, Tailwind CSS)
  - Create directory structure: components/, pages/, services/, hooks/, utils/, types/, config/
  - Configure tsconfig.json for TypeScript strict mode
  - Set up .env files for development, staging, and production environments
  - Create README.md with setup and deployment instructions
  - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [x] 2. Configure build and deployment setup
  - Create next.config.js with optimization settings (image optimization, code splitting)
  - Configure environment variable handling for API endpoint URLs
  - Set up build scripts in package.json (build, dev, start, lint)
  - Create .gitignore for landing page specific files
  - Configure Tailwind CSS for responsive design
  - _Requirements: 6.2, 6.3, 7.2_

- [x] 3. Implement API client layer and services
  - [x] 3.1 Create base API client with error handling and retry logic
    - Implement api-client.ts with axios/fetch wrapper
    - Add automatic retry with exponential backoff (3 retries)
    - Implement request/response interceptors for error handling
    - Add timeout configuration (10 seconds default)
    - _Requirements: 6.3, 9.2_
  
  - [x] 3.2 Implement hotels service for hotel data fetching
    - Create hotels.service.ts with functions: fetchHotels(), fetchHotelById(), fetchHotelRooms(), fetchPromotions()
    - Implement React Query hooks for data caching (5 minute cache)
    - Add TypeScript interfaces for Hotel, Room, Promotion types
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 4.1, 7.4_
  
  - [x] 3.3 Implement booking service for reservation integration
    - Create booking.service.ts with createBooking() and getBookingDetails()
    - Add form data validation before API submission
    - Implement duplicate submission prevention
    - _Requirements: 5.1, 5.2, 5.5, 5.6_
  
  - [x] 3.4 Implement search service for filtering functionality
    - Create search.service.ts with searchHotels() and filterRooms()
    - Add debouncing for search input (300ms delay)
    - Implement client-side filtering logic for performance
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 4. Build core UI components
  - [x] 4.1 Create layout components (Header, Footer, Navigation)
    - Implement responsive header with logo and navigation menu
    - Create footer with contact information and social media links
    - Add mobile hamburger menu for small screens
    - _Requirements: 3.2, 7.2_
  
  - [x] 4.2 Create hotel listing components
    - Implement HotelCard component displaying name, location, image, description
    - Create HotelList component with grid layout
    - Add loading skeleton components for better UX
    - Implement alphabetical sorting by property name
    - _Requirements: 1.1, 1.3, 1.5, 7.5_
  
  - [ ] 4.3 Create hotel detail components
    - Implement HotelDetail component with full description, amenities
    - Add PromotionalBanner component for special offers
    - Handle cases where no promotions exist
    - _Requirements: 1.4, 2.1, 2.2, 2.4, 2.5_
  
  - [ ] 4.4 Implement Room Image Gallery feature
    - [x] 4.4.1 Create gallery component directory structure
      - Create src/components/gallery/ directory
      - Set up component files: ImageGallery.tsx, GalleryModal.tsx, GalleryNavigation.tsx, GalleryThumbnails.tsx, GalleryImage.tsx
      - _Requirements: 4.1.1_
    
    - [x] 4.4.2 Create image paths configuration utility
      - Generate array of 74 image paths from landing-page/public/FG GRILL PHOTOS directory
      - Filter to include only valid sequential images (IMG_8680 through IMG_8907)
      - Export GALLERY_IMAGES constant for use across components
      - _Requirements: 4.1.2, 4.1.3_
    
    - [x] 4.4.3 Implement ImageGallery main component with state management
      - Create ImageGallery.tsx with props: images, initialIndex, onClose, isOpen
      - Implement state management: currentIndex, isLoading, loadedImages, thumbnailsVisible
      - Add navigation handlers: goToNext, goToPrevious, goToIndex
      - Implement image preloading logic for adjacent images (n-1, n+1)
      - Add useEffect for preloading adjacent images when currentIndex changes
      - _Requirements: 4.1.1, 4.1.4, 4.1.9_
    
    - [x] 4.4.4 Implement GalleryModal with portal rendering
      - Create GalleryModal.tsx using ReactDOM.createPortal
      - Implement full-screen overlay with semi-transparent backdrop
      - Add click-outside-to-close functionality
      - Implement body scroll lock when modal is open
      - Add ARIA attributes: role="dialog", aria-modal="true", aria-label
      - _Requirements: 4.1.1, 4.1.7_
    
    - [x] 4.4.5 Implement GalleryNavigation with keyboard and touch support
      - Create GalleryNavigation.tsx with close, previous, and next buttons
      - Add image counter display (e.g., "5 / 74")
      - Implement keyboard event handlers: ArrowRight, ArrowLeft, Escape, Home, End, T
      - Add touch/swipe gesture support for mobile (minimum 50px swipe distance)
      - Style buttons with hover states and transitions
      - _Requirements: 4.1.4, 4.1.6, 4.1.7_
    
    - [x] 4.4.6 Implement GalleryThumbnails with auto-scroll
      - Create GalleryThumbnails.tsx with horizontal scrollable strip
      - Implement auto-scroll to center active thumbnail using scrollIntoView
      - Add visual indicator for current image (border and scale)
      - Implement lazy loading for thumbnail images
      - Add toggle visibility animation (slide up/down from bottom)
      - Style with 80x80px thumbnails (responsive: 64px mobile, 96px desktop)
      - _Requirements: 4.1.4, 4.1.10_
    
    - [x] 4.4.7 Implement GalleryImage component with error handling
      - Create GalleryImage.tsx for individual image display
      - Add loading state indicator (spinner) while image loads
      - Implement error handling with fallback UI and retry button
      - Add responsive image sizing (max 70vh mobile, 80vh desktop)
      - Use object-fit: contain for proper image scaling
      - _Requirements: 4.1.5, 4.1.8_
    
    - [x] 4.4.8 Add accessibility features to gallery
      - Add ARIA labels to all interactive elements
      - Implement focus trap within modal when open
      - Add screen reader instructions (hidden div with id="gallery-instructions")
      - Ensure logical tab order through gallery controls
      - Add descriptive alt text for images with current position
      - Test with keyboard-only navigation
      - _Requirements: 4.1.6_
    
    - [x] 4.4.9 Optimize gallery performance
      - Implement React.memo for GalleryImage and GalleryThumbnails components
      - Use useMemo for galleryImages array
      - Use useCallback for navigation handlers to prevent re-renders
      - Add debouncing for rapid navigation events
      - Implement code splitting to load gallery on-demand
      - _Requirements: 4.1.9_
  
  - [x] 4.5 Update RoomCard component to integrate gallery
    - Add "View Room" button to RoomCard component
    - Implement gallery state management (galleryOpen, setGalleryOpen)
    - Add onClick handler to open ImageGallery modal
    - Pass GALLERY_IMAGES and gallery state to ImageGallery component
    - Ensure focus returns to RoomCard when gallery closes
    - Style "View Room" button to match existing design
    - _Requirements: 4.1.1, 4.1.6_
  
  - [ ] 4.6 Create room listing and availability components
    - Implement RoomCard component showing type, capacity, price, amenities, availability
    - Create DatePicker component for check-in/check-out selection
    - Add RoomFilter component for price range, amenities, capacity filters
    - Implement sorting by price (lowest to highest)
    - Display "no rooms available" message with alternative date suggestions
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 4.7 Create booking flow components
    - Implement BookingForm component with guest information fields
    - Create BookingConfirmation component displaying reference number and details
    - Add form validation with error messages
    - Implement loading states during booking submission
    - Preserve form data on network failure for resubmission
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 9.5_

- [ ] 5. Implement search and filter functionality
  - [ ] 5.1 Create search bar component with real-time filtering
    - Implement SearchBar component with debounced input (300ms)
    - Add search by hotel name and location
    - Display search results count
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ] 5.2 Implement filter controls and logic
    - Create FilterPanel component with price range, amenities, capacity options
    - Implement multi-criteria filtering logic
    - Update URL query parameters to preserve filter state
    - Display active filter count and clear filters button
    - _Requirements: 8.3, 8.4, 8.5_

- [ ] 6. Implement contact information display
  - Create ContactSection component with phone, email, address display
  - Add click-to-call functionality for phone numbers (tel: links)
  - Add click-to-email functionality (mailto: links)
  - Display business hours for each property
  - Add social media icon links
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7. Implement performance optimizations
  - [ ] 7.1 Add image optimization and lazy loading
    - Configure Next.js Image component for automatic optimization
    - Implement lazy loading for images below the fold
    - Add blur placeholders for images during loading
    - Ensure high-resolution images (1920x1080) are properly compressed
    - _Requirements: 2.4, 7.3_
  
  - [ ] 7.2 Implement caching strategy
    - Configure React Query cache time (5 minutes for hotel data)
    - Implement stale-while-revalidate pattern
    - Add service worker for offline caching (optional)
    - _Requirements: 7.4_
  
  - [ ] 7.3 Optimize bundle size and loading performance
    - Implement code splitting for route-based chunks
    - Add dynamic imports for heavy components
    - Configure Next.js for static generation where possible
    - Optimize initial page load to under 3 seconds
    - _Requirements: 7.1_

- [ ] 8. Checkpoint - Test core functionality and gallery
  - Ensure all pages load correctly and navigation works
  - Test hotel listing, detail pages, and room availability display
  - Verify search and filter functionality
  - Test Room Image Gallery on different devices (mobile, tablet, desktop)
  - Verify gallery keyboard navigation (arrow keys, Escape, Home, End, T)
  - Test gallery touch/swipe gestures on mobile devices
  - Verify image loading and lazy loading performance
  - Test gallery accessibility with keyboard-only navigation
  - Ensure thumbnail auto-scroll works correctly
  - Test booking flow end-to-end
  - Ensure all tests pass, ask the user if questions arise

- [ ] 9. Implement error handling and resilience
  - [ ] 9.1 Create error boundary components
    - Implement React error boundaries for graceful error handling
    - Create user-friendly error pages (404, 500, API unavailable)
    - Add error logging to monitoring service
    - _Requirements: 9.1, 9.4_
  
  - [ ] 9.2 Implement offline behavior and fallbacks
    - Add network status detection
    - Display cached data when API is unavailable with outdated data notification
    - Show retry button for failed requests
    - Implement fallback UI for missing images
    - _Requirements: 9.1, 9.3_
  
  - [ ] 9.3 Add comprehensive error messages
    - Create ErrorMessage component with contextual messages
    - Display specific error messages from API responses
    - Add user guidance for common errors (network issues, booking conflicts)
    - _Requirements: 5.4, 9.1_

- [ ] 10. Implement responsive design
  - Test and adjust layouts for mobile (320px-768px)
  - Test and adjust layouts for tablet (768px-1024px)
  - Test and adjust layouts for desktop (1024px-2560px)
  - Ensure touch-friendly interactive elements (min 44px tap targets)
  - Test on multiple browsers (Chrome, Firefox, Safari, Edge)
  - _Requirements: 7.2_

- [ ] 11. Create backend API endpoints in main system
  - [ ] 11.1 Implement public hotel data endpoints
    - Create GET /api/public/hotels endpoint returning all properties
    - Create GET /api/public/hotels/:id endpoint for hotel details
    - Create GET /api/public/hotels/:id/rooms endpoint for room availability
    - Create GET /api/public/hotels/:id/promotions endpoint for offers
    - Add CORS configuration for landing page domain
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 4.1, 6.3_
  
  - [ ] 11.2 Implement public booking endpoints
    - Create POST /api/public/bookings endpoint for creating reservations
    - Create GET /api/public/bookings/:reference endpoint for booking details
    - Add rate limiting to prevent abuse
    - Implement booking validation and conflict checking
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 11.3 Implement public search endpoints
    - Create GET /api/public/search/hotels endpoint with query parameter
    - Create GET /api/public/search/rooms endpoint with filter parameters
    - Add query optimization for performance
    - _Requirements: 8.1, 8.4_

- [ ] 12. Final integration and testing
  - [ ] 12.1 Connect landing page to main system APIs
    - Configure environment variables with API endpoint URLs
    - Test all API integrations end-to-end
    - Verify data synchronization (5 minute update requirement)
    - _Requirements: 1.2, 2.3, 6.3, 6.4_
  
  - [ ] 12.2 Perform cross-browser and device testing
    - Test on iOS Safari, Android Chrome
    - Test on various screen sizes and orientations
    - Verify performance metrics (load time, API response time)
    - _Requirements: 7.1, 7.2_
  
  - [ ] 12.3 Verify independent deployment
    - Test deployment to staging environment
    - Verify main system continues operating during landing page deployment
    - Test environment configuration switching
    - Validate version numbering system
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

- [ ] 13. Final checkpoint - Production readiness
  - Ensure all tests pass and no critical bugs remain
  - Verify all requirements are met
  - Confirm deployment documentation is complete
  - Ask the user if questions arise before production deployment

## Notes

- The landing page is built in a completely separate `landing-page/` directory for independent deployment
- All integration with the main system happens through REST API endpoints
- React Query provides automatic caching and data synchronization
- Next.js enables server-side rendering for optimal SEO and performance
- The landing page can be deployed to Vercel, Netlify, or any static hosting service
- Environment variables allow easy switching between development, staging, and production APIs
