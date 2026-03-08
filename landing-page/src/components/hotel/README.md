# Hotel Components

This directory contains components for displaying hotel properties on the FamousGates Hotels Landing Page.

## Components

### HotelCard

Displays a single hotel property with image, name, location, and description.

**Props:**
- `hotel: Hotel` - Hotel data object

**Features:**
- Responsive image with hover effect
- Location icon with address
- Truncated description (3 lines max)
- Click to navigate to hotel detail page
- Hover effects for better UX

**Usage:**
```tsx
import { HotelCard } from '@/components/hotel';

<HotelCard hotel={hotelData} />
```

### HotelCardSkeleton

Loading skeleton component for hotel cards.

**Features:**
- Animated pulse effect
- Matches HotelCard layout
- Provides visual feedback during data loading

**Usage:**
```tsx
import { HotelCardSkeleton } from '@/components/hotel';

<HotelCardSkeleton />
```

### HotelList

Container component that displays a grid of hotel cards with loading and error states.

**Props:**
- `hotels: Hotel[]` - Array of hotel data
- `isLoading?: boolean` - Loading state flag
- `error?: Error | null` - Error object if fetch failed

**Features:**
- Alphabetical sorting by property name (Requirement 1.5)
- Responsive grid layout (1 column mobile, 2 tablet, 3 desktop)
- Loading state with skeleton cards
- Error state with retry button
- Empty state when no hotels found

**Usage:**
```tsx
import { HotelList } from '@/components/hotel';
import { useHotels } from '@/hooks/useHotels';

const MyComponent = () => {
  const { data: hotels, isLoading, error } = useHotels();
  
  return (
    <HotelList 
      hotels={hotels || []} 
      isLoading={isLoading}
      error={error}
    />
  );
};
```

## Requirements Satisfied

- **Requirement 1.1**: Display list of all hotel properties
- **Requirement 1.3**: Display name, location, image, and description for each property
- **Requirement 1.5**: Alphabetical sorting by property name
- **Requirement 7.5**: Loading indicators for better UX

## Styling

All components use Tailwind CSS for styling with:
- Responsive breakpoints (mobile, tablet, desktop)
- Hover effects and transitions
- Custom color palette from theme
- Accessible focus states
