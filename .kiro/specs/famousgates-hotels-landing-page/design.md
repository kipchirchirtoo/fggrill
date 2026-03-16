# Design Document: FamousGates Hotels Landing Page

## Overview

The FamousGates Hotels Landing Page is a standalone, independently deployable web application that serves as the public-facing homepage for FamousGates Hotels. This design emphasizes separation from the main hotel management system while maintaining seamless integration through well-defined API boundaries.

The landing page will be built as a modern, responsive single-page application (SPA) using React with Next.js for server-side rendering and optimal performance. It will be deployed in its own directory structure with independent build and deployment pipelines, allowing for updates without affecting the main system.

Key design principles:
- **Independent Deployment**: Complete separation from main system codebase
- **API-First Integration**: All data fetched through REST API endpoints
- **Performance Optimization**: Caching, lazy loading, and code splitting
- **Responsive Design**: Mobile-first approach supporting all screen sizes
- **Error Resilience**: Graceful degradation with offline support

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Landing Page Application"
        UI[React UI Components]
        State[State Management - React Query]
        Cache[Client-Side Cache]
        API[API Client Layer]
    end
    
    subgraph "Main Hotel System"
        REST[REST API Endpoints]
        DB[(Database)]
    end
    
    Visitor[Website Visitor] --> UI
    UI --> State
    State --> Cache
    State --> API
    API -->|HTTPS| REST
    REST --> DB
    
    Cache -.->|Fallback| UI
```

### Directory Structure

```
landing-page/                    # Separate root directory
├── public/                      # Static assets
│   ├── images/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── components/              # React components
│   │   ├── common/              # Reusable components
│   │   ├── hotel/               # Hotel-specific components
│   │   ├── booking/             # Booking flow components
│   │   └── layout/              # Layout components
│   ├── pages/                   # Next.js pages
│   │   ├── index.tsx            # Home page
│   │   ├── hotels/
│   │   │   └── [id].tsx         # Hotel detail page
│   │   └── booking/
│   │       └── confirmation.tsx # Booking confirmation
│   ├── services/                # API integration
│   │   ├── api-client.ts        # Base API client
│   │   ├── hotels.service.ts    # Hotel data service
│   │   └── booking.service.ts   # Booking service
│   ├── hooks/                   # Custom React hooks
│   ├── utils/                   # Utility functions
│   ├── types/                   # TypeScript types
│   └── config/                  # Configuration
│       └── environment.ts       # Environment config
├── .env.development             # Dev environment variables
├── .env.staging                 # Staging environment variables
├── .env.production              # Production environment variables
├── package.json                 # Dependencies and scripts
├── next.config.js               # Next.js configuration
├── tsconfig.json                # TypeScript configuration
└── README.md                    # Documentation
```

### Deployment Architecture

The landing page will be deployed independently using the following approach:

1. **Separate Build Pipeline**: Own CI/CD pipeline triggered independently
2. **Static Hosting**: Deploy to CDN (Vercel, Netlify, or AWS S3 + CloudFront)
3. **Environment Configuration**: Environment variables for API endpoints
4. **Version Management**: Semantic versioning independent of main system

### API Integration Layer

The landing page communicates with the main system through these API endpoints:

**Hotel Data Endpoints:**
- `GET /api/public/hotels` - List all hotel properties
- `GET /api/public/hotels/:id` - Get hotel details
- `GET /api/public/hotels/:id/rooms` - Get available rooms
- `GET /api/public/hotels/:id/promotions` - Get promotional offers

**Booking Endpoints:**
- `POST /api/public/bookings` - Create new booking
- `GET /api/public/bookings/:reference` - Get booking details

**Search Endpoints:**
- `GET /api/public/search/hotels?q=:query` - Search hotels
- `GET /api/public/search/rooms?filters=:filters` - Filter rooms

## Components and Interfaces

### Core Component Architecture

The landing page follows a component-based architecture with clear separation of concerns:

```
src/components/
├── common/                      # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── LoadingSpinner.tsx
│   └── Modal.tsx
├── hotel/                       # Hotel-specific components
│   ├── HotelCard.tsx
│   ├── HotelList.tsx
│   ├── HotelDetail.tsx
│   └── RoomCard.tsx
├── gallery/                     # Image gallery components
│   ├── ImageGallery.tsx         # Main gallery component
│   ├── GalleryModal.tsx         # Modal wrapper for gallery
│   ├── GalleryNavigation.tsx    # Navigation controls
│   ├── GalleryThumbnails.tsx    # Thumbnail strip
│   └── GalleryImage.tsx         # Individual image display
├── booking/                     # Booking flow components
│   ├── BookingForm.tsx
│   ├── DatePicker.tsx
│   └── ConfirmationPage.tsx
└── layout/                      # Layout components
    ├── Header.tsx
    ├── Footer.tsx
    └── Navigation.tsx
```

### ImageGallery Component (Requirement 4.1)

The ImageGallery component provides an interactive, performant image viewing experience for hotel room and amenity photos.

#### Component Structure

```typescript
// src/components/gallery/ImageGallery.tsx
interface ImageGalleryProps {
  images: string[];              // Array of image paths
  initialIndex?: number;         // Starting image index
  onClose: () => void;           // Close callback
  isOpen: boolean;               // Modal open state
}

interface GalleryState {
  currentIndex: number;          // Currently displayed image
  isLoading: boolean;            // Loading state
  loadedImages: Set<number>;     // Track loaded images
  thumbnailsVisible: boolean;    // Thumbnail strip visibility
}
```

#### State Management Approach

The ImageGallery uses React hooks for local state management:

**Primary State:**
- `currentIndex`: Tracks the currently displayed image (0-73)
- `isLoading`: Shows loading indicator during image transitions
- `loadedImages`: Set of indices for preloaded images
- `thumbnailsVisible`: Toggle for thumbnail strip display

**State Management Pattern:**
```typescript
const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));
const [isLoading, setIsLoading] = useState(false);
const [thumbnailsVisible, setThumbnailsVisible] = useState(true);

// Navigation handlers
const goToNext = useCallback(() => {
  setCurrentIndex((prev) => (prev + 1) % images.length);
}, [images.length]);

const goToPrevious = useCallback(() => {
  setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
}, [images.length]);

const goToIndex = useCallback((index: number) => {
  setCurrentIndex(index);
}, []);
```

#### Image Loading and Optimization Strategy

**Lazy Loading Implementation:**
1. **Initial Load**: Load only the first image immediately
2. **Adjacent Preloading**: Preload previous and next images (n-1, n+1)
3. **Progressive Loading**: Load thumbnails at reduced resolution
4. **On-Demand Loading**: Load full-resolution images when navigated to

**Image Optimization Techniques:**
```typescript
// Image preloading utility
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// Preload adjacent images
useEffect(() => {
  const preloadAdjacent = async () => {
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    const nextIndex = (currentIndex + 1) % images.length;
    
    const toPreload = [prevIndex, nextIndex].filter(
      (idx) => !loadedImages.has(idx)
    );
    
    await Promise.all(toPreload.map((idx) => preloadImage(images[idx])));
    
    setLoadedImages((prev) => {
      const updated = new Set(prev);
      toPreload.forEach((idx) => updated.add(idx));
      return updated;
    });
  };
  
  preloadAdjacent();
}, [currentIndex, images, loadedImages]);
```

**Image Path Configuration:**
```typescript
// Generate image paths from directory
const GALLERY_IMAGES = Array.from({ length: 74 }, (_, i) => {
  const imageNumber = 8680 + i;
  return `/FG GRILL PHOTOS/IMG_${imageNumber}.JPG`;
}).filter((path) => {
  // Filter out non-sequential images
  const validImages = [
    8680, 8689, 8695, 8696, 8700, 8703, 8704, 8706, 8712, 8715,
    8722, 8725, 8727, 8729, 8732, 8733, 8736, 8738, 8739, 8740,
    8742, 8743, 8744, 8746, 8749, 8753, 8754, 8755, 8757, 8758,
    8762, 8763, 8764, 8765, 8769, 8776, 8777, 8778, 8782, 8790,
    8801, 8803, 8805, 8807, 8810, 8814, 8815, 8816, 8817, 8818,
    8819, 8823, 8862, 8864, 8866, 8867, 8868, 8869, 8873, 8875,
    8877, 8878, 8882, 8883, 8884, 8885, 8886, 8903, 8904, 8905,
    8906, 8907
  ];
  const num = parseInt(path.match(/IMG_(\d+)/)?.[1] || '0');
  return validImages.includes(num);
});
```

#### Modal/Lightbox Implementation

**Modal Architecture:**
```typescript
// src/components/gallery/GalleryModal.tsx
const GalleryModal: React.FC<GalleryModalProps> = ({ 
  isOpen, 
  onClose, 
  children 
}) => {
  // Portal rendering for proper z-index layering
  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Image Gallery"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-90"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Content */}
      <div className="relative h-full w-full">
        {children}
      </div>
    </div>,
    document.body
  );
};
```

**Modal Features:**
- Full-screen overlay with semi-transparent backdrop
- Click outside to close
- Escape key to close
- Prevents body scroll when open
- Accessible with ARIA attributes
- Portal rendering for proper stacking context

**Body Scroll Lock:**
```typescript
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }
}, [isOpen]);
```

#### Keyboard Event Handling

**Keyboard Navigation Implementation:**
```typescript
useEffect(() => {
  if (!isOpen) return;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        goToNext();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        goToPrevious();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Home':
        e.preventDefault();
        goToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        goToIndex(images.length - 1);
        break;
      case 't':
      case 'T':
        e.preventDefault();
        setThumbnailsVisible((prev) => !prev);
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, goToNext, goToPrevious, onClose, goToIndex, images.length]);
```

**Supported Keyboard Shortcuts:**
- `Arrow Right`: Next image
- `Arrow Left`: Previous image
- `Escape`: Close gallery
- `Home`: First image
- `End`: Last image
- `T`: Toggle thumbnails

#### Navigation Controls

**Navigation Component Structure:**
```typescript
// src/components/gallery/GalleryNavigation.tsx
const GalleryNavigation: React.FC<NavigationProps> = ({
  currentIndex,
  totalImages,
  onNext,
  onPrevious,
  onClose,
}) => {
  return (
    <>
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full 
                   bg-black bg-opacity-50 hover:bg-opacity-75 
                   text-white transition-all"
        aria-label="Close gallery"
      >
        <XIcon className="w-6 h-6" />
      </button>
      
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 
                   p-3 rounded-full bg-black bg-opacity-50 
                   hover:bg-opacity-75 text-white transition-all"
        aria-label="Previous image"
      >
        <ChevronLeftIcon className="w-8 h-8" />
      </button>
      
      {/* Next Button */}
      <button
        onClick={onNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 
                   p-3 rounded-full bg-black bg-opacity-50 
                   hover:bg-opacity-75 text-white transition-all"
        aria-label="Next image"
      >
        <ChevronRightIcon className="w-8 h-8" />
      </button>
      
      {/* Image Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 
                      px-4 py-2 rounded-full bg-black bg-opacity-50 
                      text-white text-sm">
        {currentIndex + 1} / {totalImages}
      </div>
    </>
  );
};
```

**Touch/Swipe Gesture Support:**
```typescript
// Touch event handlers for mobile swipe
const [touchStart, setTouchStart] = useState<number | null>(null);
const [touchEnd, setTouchEnd] = useState<number | null>(null);

const minSwipeDistance = 50;

const onTouchStart = (e: React.TouchEvent) => {
  setTouchEnd(null);
  setTouchStart(e.targetTouches[0].clientX);
};

const onTouchMove = (e: React.TouchEvent) => {
  setTouchEnd(e.targetTouches[0].clientX);
};

const onTouchEnd = () => {
  if (!touchStart || !touchEnd) return;
  
  const distance = touchStart - touchEnd;
  const isLeftSwipe = distance > minSwipeDistance;
  const isRightSwipe = distance < -minSwipeDistance;
  
  if (isLeftSwipe) {
    goToNext();
  } else if (isRightSwipe) {
    goToPrevious();
  }
};
```

#### Thumbnail Preview Component

**Thumbnail Strip Implementation:**
```typescript
// src/components/gallery/GalleryThumbnails.tsx
const GalleryThumbnails: React.FC<ThumbnailsProps> = ({
  images,
  currentIndex,
  onSelectImage,
  visible,
}) => {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to center current thumbnail
  useEffect(() => {
    if (thumbnailRef.current) {
      const thumbnail = thumbnailRef.current.children[currentIndex] as HTMLElement;
      thumbnail?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIndex]);
  
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-black 
                  bg-opacity-75 transition-transform duration-300 
                  ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div
        ref={thumbnailRef}
        className="flex gap-2 p-4 overflow-x-auto scrollbar-thin 
                   scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => onSelectImage(index)}
            className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden 
                       border-2 transition-all ${
                         index === currentIndex
                           ? 'border-white scale-110'
                           : 'border-transparent opacity-60 hover:opacity-100'
                       }`}
            aria-label={`Go to image ${index + 1}`}
            aria-current={index === currentIndex ? 'true' : 'false'}
          >
            <img
              src={image}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
```

**Thumbnail Features:**
- Horizontal scrollable strip at bottom
- Auto-scroll to center active thumbnail
- Visual indicator for current image (border + scale)
- Lazy loading for thumbnail images
- Smooth transitions
- Toggle visibility with keyboard shortcut

#### Responsive Design Considerations

**Breakpoint Strategy:**
```typescript
// Tailwind breakpoints
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
};
```

**Responsive Image Sizing:**
```css
/* Mobile (< 640px) */
.gallery-image {
  max-width: 100vw;
  max-height: 70vh; /* Leave space for thumbnails */
}

/* Tablet (640px - 1024px) */
@media (min-width: 640px) {
  .gallery-image {
    max-width: 90vw;
    max-height: 75vh;
  }
}

/* Desktop (> 1024px) */
@media (min-width: 1024px) {
  .gallery-image {
    max-width: 85vw;
    max-height: 80vh;
  }
}
```

**Responsive Navigation:**
- Mobile: Smaller buttons, swipe gestures primary
- Tablet: Medium buttons, both touch and click
- Desktop: Larger buttons, keyboard navigation emphasized

**Thumbnail Responsiveness:**
```typescript
// Adjust thumbnail size based on screen width
const getThumbnailSize = () => {
  if (window.innerWidth < 640) return 'w-16 h-16';  // Mobile
  if (window.innerWidth < 1024) return 'w-20 h-20'; // Tablet
  return 'w-24 h-24';                                // Desktop
};
```

#### Integration with RoomCard Component

**RoomCard Component Update:**
```typescript
// src/components/hotel/RoomCard.tsx
const RoomCard: React.FC<RoomCardProps> = ({ room }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  
  return (
    <>
      <div className="room-card">
        {/* Room details */}
        <h3>{room.type}</h3>
        <p>{room.description}</p>
        <p className="price">${room.pricePerNight}/night</p>
        
        {/* View Room Button */}
        <button
          onClick={() => setGalleryOpen(true)}
          className="view-room-btn"
        >
          View Room
        </button>
        
        {/* Book Now Button */}
        <button className="book-now-btn">
          Book Now
        </button>
      </div>
      
      {/* Image Gallery Modal */}
      <ImageGallery
        images={GALLERY_IMAGES}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialIndex={0}
      />
    </>
  );
};
```

**Integration Points:**
1. "View Room" button triggers gallery modal
2. Gallery state managed in RoomCard component
3. Gallery images shared across all room cards
4. Modal closes return focus to RoomCard

#### Performance Optimizations

**Image Loading Performance:**
1. **Lazy Loading**: Only load visible and adjacent images
2. **Progressive Enhancement**: Show low-res placeholder first
3. **Caching**: Browser caches loaded images automatically
4. **Preloading**: Preload next/previous images in background
5. **Debouncing**: Debounce rapid navigation to prevent overload

**React Performance:**
```typescript
// Memoize expensive computations
const galleryImages = useMemo(() => GALLERY_IMAGES, []);

// Memoize callbacks to prevent re-renders
const handleNext = useCallback(() => {
  setCurrentIndex((prev) => (prev + 1) % galleryImages.length);
}, [galleryImages.length]);

// Memoize child components
const MemoizedGalleryImage = memo(GalleryImage);
const MemoizedThumbnails = memo(GalleryThumbnails);
```

**Bundle Size Optimization:**
- Code splitting: Gallery component loaded on-demand
- Tree shaking: Remove unused icon components
- Image optimization: Serve WebP format where supported

#### Accessibility Features

**ARIA Attributes:**
```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-label="Image Gallery"
  aria-describedby="gallery-instructions"
>
  <div id="gallery-instructions" className="sr-only">
    Use arrow keys to navigate between images. 
    Press Escape to close the gallery.
  </div>
  
  <img
    src={currentImage}
    alt={`Hotel room image ${currentIndex + 1} of ${images.length}`}
    role="img"
  />
</div>
```

**Keyboard Accessibility:**
- All interactive elements keyboard accessible
- Focus trap within modal when open
- Clear focus indicators
- Logical tab order

**Screen Reader Support:**
- Descriptive alt text for images
- Announce current image number
- Announce navigation actions
- Hidden instructions for keyboard shortcuts

#### Error Handling

**Image Load Error Handling:**
```typescript
const [imageError, setImageError] = useState(false);

const handleImageError = () => {
  setImageError(true);
  console.error(`Failed to load image: ${images[currentIndex]}`);
};

// Fallback UI
{imageError ? (
  <div className="flex flex-col items-center justify-center h-full">
    <ImageOffIcon className="w-16 h-16 text-gray-400 mb-4" />
    <p className="text-white">Failed to load image</p>
    <button onClick={() => setImageError(false)} className="mt-4">
      Retry
    </button>
  </div>
) : (
  <img
    src={images[currentIndex]}
    onError={handleImageError}
    alt={`Image ${currentIndex + 1}`}
  />
)}
```

**Loading States:**
```typescript
{isLoading && (
  <div className="absolute inset-0 flex items-center justify-center">
    <LoadingSpinner className="w-12 h-12 text-white" />
  </div>
)}
```

**Network Error Handling:**
```typescript
const [networkError, setNetworkError] = useState(false);

// Retry mechanism for failed image loads
const retryImageLoad = async (index: number, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await preloadImage(images[index]);
      setNetworkError(false);
      return true;
    } catch (error) {
      if (i === retries - 1) {
        setNetworkError(true);
        console.error(`Failed to load image after ${retries} attempts`);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  return false;
};
```

**Error Recovery UI:**
- Display user-friendly error messages
- Provide retry button for failed loads
- Show placeholder image on persistent failures
- Log errors for monitoring and debugging

### Other Core Components
Other Core Components

#### HotelCard Component
Displays hotel property summary with image, name, location, and description.

#### HotelList Component
Grid layout of HotelCard components with filtering and sorting capabilities.

#### BookingForm Component
Multi-step form for collecting guest information and booking details.

#### SearchBar Component
Search input with autocomplete and filter options.

## Data Models

### Hotel Property Model

```typescript
interface HotelProperty {
  id: string;
  name: string;
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  description: string;
  shortDescription: string;
  images: {
    primary: string;
    gallery: string[];
  };
  amenities: string[];
  contactInfo: {
    phone: string;
    email: string;
    businessHours: {
      open: string;
      close: string;
      days: string[];
    };
  };
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  rating: number;
  reviewCount: number;
}
```

### Room Listing Model

```typescript
interface RoomListing {
  id: string;
  hotelId: string;
  type: string;
  capacity: {
    adults: number;
    children: number;
  };
  pricePerNight: number;
  currency: string;
  amenities: string[];
  images: string[];
  description: string;
  availability: {
    available: boolean;
    nextAvailableDate?: string;
  };
  size: {
    value: number;
    unit: 'sqm' | 'sqft';
  };
  bedConfiguration: {
    type: string;
    count: number;
  }[];
}
```

### Booking Model

```typescript
interface Booking {
  id: string;
  referenceNumber: string;
  hotelId: string;
  roomId: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  dates: {
    checkIn: string;  // ISO 8601 format
    checkOut: string; // ISO 8601 format
    nights: number;
  };
  pricing: {
    roomRate: number;
    taxes: number;
    fees: number;
    total: number;
    currency: string;
  };
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
```

### Gallery Image Model

```typescript
interface GalleryImage {
  src: string;           // Image path
  alt: string;           // Alt text for accessibility
  width?: number;        // Original width
  height?: number;       // Original height
  thumbnail?: string;    // Thumbnail path (optional)
  caption?: string;      // Image caption (optional)
  category?: string;     // Image category (room, amenity, dining, etc.)
}

// Gallery configuration
interface GalleryConfig {
  images: GalleryImage[];
  preloadCount: number;  // Number of images to preload
  thumbnailSize: number; // Thumbnail dimensions
  transitionDuration: number; // Animation duration in ms
  enableKeyboard: boolean;
  enableTouch: boolean;
  enableThumbnails: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Gallery Image Navigation Bounds

*For any* image index in the gallery, navigating forward or backward should always result in a valid index within the bounds [0, imageCount-1], wrapping around at the edges.

**Validates: Requirements 4.1.4**

### Property 2: Gallery Keyboard Navigation Consistency

*For any* keyboard event (ArrowLeft, ArrowRight, Escape, Home, End), the gallery should respond with the corresponding navigation action and maintain consistent state.

**Validates: Requirements 4.1.6**

### Property 3: Gallery Modal State Synchronization

*For any* gallery open/close action, the modal visibility state and body scroll lock should be synchronized (modal open = body scroll locked, modal closed = body scroll unlocked).

**Validates: Requirements 4.1.7**

### Property 4: Image Preloading Adjacency

*For any* currently displayed image at index N, the gallery should have preloaded or be preloading images at indices N-1 and N+1 (with wraparound).

**Validates: Requirements 4.1.9**

### Property 5: Thumbnail Selection Consistency

*For any* thumbnail clicked at index N, the main gallery view should display the image at index N and the thumbnail strip should scroll to center that thumbnail.

**Validates: Requirements 4.1.10**

### Property 6: Hotel Data Freshness

*For any* hotel property data fetched from the API, if the data is older than 5 minutes, the landing page should refetch the data from the main system.

**Validates: Requirements 1.2, 2.3**

### Property 7: Booking Data Integrity

*For any* booking submission, all required fields (guest info, dates, room selection) must be present and valid before transmission to the main system.

**Validates: Requirements 5.2**

### Property 8: Search Filter Consistency

*For any* combination of active filters, the displayed results should include only items that match ALL active filter criteria.

**Validates: Requirements 8.4**

### Property 9: Error Retry Exponential Backoff

*For any* failed API request, the system should retry up to 3 times with exponentially increasing delays (1s, 2s, 4s) before showing an error to the user.

**Validates: Requirements 9.2**

### Property 10: Responsive Image Sizing

*For any* viewport width, gallery images should be sized to fit 
within the viewport without horizontal scrolling while maintaining aspect ratio.

**Validates: Requirements 4.1.5, 7.2**

## Error Handling

### API Error Handling Strategy

**Error Categories:**
1. **Network Errors**: Connection failures, timeouts
2. **Server Errors**: 5xx responses from main system
3. **Client Errors**: 4xx responses (validation, not found)
4. **Data Errors**: Invalid or malformed response data

**Handling Approach:**

```typescript
// Centralized error handler
class APIErrorHandler {
  handle(error: APIError): ErrorResponse {
    if (error.isNetworkError()) {
      return this.handleNetworkError(error);
    } else if (error.isServerError()) {
      return this.handleServerError(error);
    } else if (error.isClientError()) {
      return this.handleClientError(error);
    } else {
      return this.handleUnknownError(error);
    }
  }
  
  private handleNetworkError(error: APIError): ErrorResponse {
    // Retry with exponential backoff
    // Show cached data if available
    // Display user-friendly message
    return {
      message: 'Connection issue. Retrying...',
      retry: true,
      useCached: true,
    };
  }
  
  private handleServerError(error: APIError): ErrorResponse {
    // Log to monitoring service
    // Show generic error message
    // Provide contact information
    return {
      message: 'Service temporarily unavailable. Please try again later.',
      retry: true,
      showSupport: true,
    };
  }
  
  private handleClientError(error: APIError): ErrorResponse {
    // Show specific validation errors
    // Guide user to correct input
    return {
      message: error.message,
      retry: false,
      showValidation: true,
    };
  }
}
```

### Gallery-Specific Error Handling

**Image Load Failures:**
- Retry failed image loads up to 3 times
- Show placeholder image on persistent failure
- Log errors for monitoring
- Allow user to manually retry

**Navigation Errors:**
- Validate index bounds before navigation
- Handle edge cases (empty gallery, single image)
- Prevent rapid navigation that could cause issues

**Modal Errors:**
- Ensure modal can always be closed
- Handle portal rendering failures gracefully
- Prevent body scroll lock from persisting

### Offline Behavior

**Cached Data Strategy:**
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? Date.now() > entry.expiresAt : true;
  }
}
```

**Offline Detection:**
```typescript
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};
```

**Offline UI Indicators:**
- Banner notification when offline
- Disable booking functionality
- Show cached data with timestamp
- Provide retry button when back online

## Testing Strategy

### Unit Testing

**Component Testing:**
- Test individual components in isolation
- Mock API calls and external dependencies
- Verify prop handling and state management
- Test error states and edge cases

**Example Unit Tests:**
```typescript
describe('ImageGallery', () => {
  it('should display the initial image', () => {
    const images = ['img1.jpg', 'img2.jpg'];
    render(<ImageGallery images={images} initialIndex={0} isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByAlt(/image 1/i)).toBeInTheDocument();
  });
  
  it('should navigate to next image on arrow click', () => {
    const images = ['img1.jpg', 'img2.jpg'];
    render(<ImageGallery images={images} initialIndex={0} isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByLabelText(/next image/i));
    expect(screen.getByAlt(/image 2/i)).toBeInTheDocument();
  });
  
  it('should close on escape key', () => {
    const onClose = jest.fn();
    render(<ImageGallery images={['img1.jpg']} isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  
  it('should handle empty image array', () => {
    render(<ImageGallery images={[]} isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText(/no images available/i)).toBeInTheDocument();
  });
});
```

### Property-Based Testing

**Gallery Navigation Properties:**
```typescript
// Using fast-check for property-based testing
import fc from 'fast-check';

describe('ImageGallery Properties', () => {
  it('Property 1: Navigation bounds - Feature: famousgates-hotels-landing-page, Property 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // image count
        fc.integer({ min: 0, max: 100 }), // current index
        (imageCount, currentIndex) => {
          if (imageCount === 0) return true;
          
          const validIndex = currentIndex % imageCount;
          const nextIndex = (validIndex + 1) % imageCount;
          const prevIndex = (validIndex - 1 + imageCount) % imageCount;
          
          // Verify indices are always within bounds
          expect(nextIndex).toBeGreaterThanOrEqual(0);
          expect(nextIndex).toBeLessThan(imageCount);
          expect(prevIndex).toBeGreaterThanOrEqual(0);
          expect(prevIndex).toBeLessThan(imageCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 4: Image preloading adjacency - Feature: famousgates-hotels-landing-page, Property 4', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 3, maxLength: 100 }), // images
        fc.integer({ min: 0, max: 99 }), // current index
        async (images, rawIndex) => {
          const currentIndex = rawIndex % images.length;
          const prevIndex = (currentIndex - 1 + images.length) % images.length;
          const nextIndex = (currentIndex + 1) % images.length;
          
          const { result } = renderHook(() => useImagePreloader(images, currentIndex));
          
          await waitFor(() => {
            expect(result.current.loadedImages.has(prevIndex)).toBe(true);
            expect(result.current.loadedImages.has(nextIndex)).toBe(true);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**API Integration Properties:**
```typescript
describe('API Integration Properties', () => {
  it('Property 6: Hotel data freshness - Feature: famousgates-hotels-landing-page, Property 6', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600000 }), // age in ms
        (dataAge) => {
          const cacheEntry = {
            data: { id: '1', name: 'Test Hotel' },
            timestamp: Date.now() - dataAge,
            expiresAt: Date.now() - dataAge + 300000, // 5 min TTL
          };
          
          const shouldRefetch = Date.now() > cacheEntry.expiresAt;
          const isStale = dataAge > 300000;
          
          expect(shouldRefetch).toBe(isStale);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 9: Error retry exponential backoff - Feature: famousgates-hotels-landing-page, Property 9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // retry attempt (0-2)
        (attempt) => {
          const expectedDelay = Math.pow(2, attempt) * 1000;
          const actualDelay = calculateRetryDelay(attempt);
          
          expect(actualDelay).toBe(expectedDelay);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**End-to-End Gallery Flow:**
```typescript
describe('Gallery Integration', () => {
  it('should complete full gallery interaction flow', async () => {
    render(<RoomCard room={mockRoom} />);
    
    // Open gallery
    fireEvent.click(screen.getByText(/view room/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Navigate through images
    fireEvent.click(screen.getByLabelText(/next image/i));
    await waitFor(() => {
      expect(screen.getByAlt(/image 2/i)).toBeInTheDocument();
    });
    
    // Use keyboard navigation
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByAlt(/image 1/i)).toBeInTheDocument();
    });
    
    // Click thumbnail
    fireEvent.click(screen.getAllByRole('button', { name: /go to image/i })[2]);
    await waitFor(() => {
      expect(screen.getByAlt(/image 3/i)).toBeInTheDocument();
    });
    
    // Close gallery
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
```

### Performance Testing

**Image Loading Performance:**
- Measure time to first image display
- Track preloading efficiency
- Monitor memory usage with large galleries
- Test on various network conditions (3G, 4G, WiFi)

**Rendering Performance:**
- Measure component render times
- Track re-render frequency
- Monitor frame rate during animations
- Test with various device capabilities

### Accessibility Testing

**Automated Accessibility:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Gallery Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ImageGallery images={mockImages} isOpen={true} onClose={jest.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Manual Accessibility Testing:**
- Keyboard-only navigation
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Color contrast verification
- Focus management validation

### Test Configuration

**Property-Based Test Settings:**
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Shrinking enabled for counterexample minimization
- Timeout: 10 seconds per property

**Coverage Requirements:**
- Unit test coverage: >80%
- Integration test coverage: >70%
- Property tests: All correctness properties implemented
- E2E tests: Critical user paths covered

## Deployment and Operations

### Build Configuration

**Next.js Build Optimization:**
```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['api.famousgateshotels.com'],
    formats: ['image/webp', 'image/avif'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        gallery: {
          test: /[\\/]components[\\/]gallery[\\/]/,
          name: 'gallery',
          priority: 10,
        },
      },
    };
    return config;
  },
};
```

### Environment Configuration

**Environment Variables:**
```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.famousgateshotels.com
NEXT_PUBLIC_CACHE_TTL=300000
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_SENTRY_DSN=https://...
```

### Monitoring and Logging

**Error Tracking:**
- Sentry integration for error monitoring
- Custom error boundaries for graceful degradation
- Performance monitoring with Web Vitals

**Analytics:**
- Track gallery usage metrics
- Monitor image load performance
- Measure user engagement
- Track booking conversion rates

### Performance Monitoring

**Key Metrics:**
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)
- Gallery open time
- Image load time

**Targets:**
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1
- Gallery open < 500ms
- Image load < 1s

## Security Considerations

### API Security

**Authentication:**
- Public endpoints require no authentication
- Rate limiting on all endpoints
- CORS configuration for landing page domain

**Data Validation:**
- Validate all user inputs
- Sanitize data before display
- Prevent XSS attacks
- Validate image URLs

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               img-src 'self' https://api.famousgateshotels.com; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               style-src 'self' 'unsafe-inline';">
```

### Image Security

**Image Validation:**
- Verify image file types
- Check image dimensions
- Scan for malicious content
- Implement image CDN with security headers

## Future Enhancements

### Gallery Enhancements

1. **Zoom Functionality**: Pinch-to-zoom on mobile, mouse wheel zoom on desktop
2. **Image Captions**: Display descriptive captions for each image
3. **Fullscreen Mode**: Native fullscreen API support
4. **Share Functionality**: Share specific images on social media
5. **Download Option**: Allow users to download images
6. **360° Views**: Support for panoramic room views
7. **Video Support**: Integrate video tours alongside images

### Performance Enhancements

1. **Progressive Web App**: Add service worker for offline support
2. **Image CDN**: Implement CDN for faster image delivery
3. **WebP/AVIF**: Serve next-gen image formats
4. **Lazy Hydration**: Defer JavaScript hydration for below-fold content

### Feature Enhancements

1. **Virtual Tours**: 3D room tours integration
2. **AR Preview**: Augmented reality room preview
3. **Comparison Tool**: Compare multiple rooms side-by-side
4. **Favorites**: Save favorite rooms for later
5. **Price Alerts**: Notify users of price drops

