# FamousGates Hotels Landing Page

A standalone, independently deployable landing page for FamousGates Hotels. Built with Next.js, TypeScript, and React Query.

## Overview

This landing page is completely separate from the main hotel management system and integrates through REST API endpoints. It showcases hotel properties, displays room availability, and provides booking functionality.

## Features

- 🏨 Display all FamousGates Hotels properties
- 🛏️ Show available rooms with pricing and amenities
- 📅 Date-based room availability filtering
- 🔍 Search and filter hotels by location, price, and amenities
- 📱 Fully responsive design (mobile, tablet, desktop)
- ⚡ Optimized performance with caching and lazy loading
- 🔒 Secure booking integration with main system
- 🌐 Multi-environment support (development, staging, production)

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript (strict mode)
- **UI Library**: React 18
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Deployment**: Vercel / Netlify / AWS S3 + CloudFront

## Project Structure

```
landing-page/
├── public/                  # Static assets
├── src/
│   ├── components/          # React components
│   ├── pages/              # Next.js pages
│   ├── services/           # API integration
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript types
│   └── config/             # Configuration
├── .env.development        # Dev environment variables
├── .env.staging           # Staging environment variables
├── .env.production        # Production environment variables
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Access to the main hotel management system API

### Installation

1. Navigate to the landing page directory:
```bash
cd landing-page
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
   - Copy `.env.development` and update the API URL if needed
   - For staging/production, use the respective `.env` files

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

The landing page will be available at [http://localhost:3001](http://localhost:3001)

### Building for Production

Build the application:

```bash
npm run build
# or
yarn build
```

Start the production server:

```bash
npm start
# or
yarn start
```

### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
# or
yarn type-check
```

### Linting

Run ESLint:

```bash
npm run lint
# or
yarn lint
```

## Environment Configuration

The landing page uses environment variables to configure API endpoints and features:

### Development (.env.development)
- `NEXT_PUBLIC_API_BASE_URL`: Local API endpoint (default: http://localhost:3000/api)
- `NEXT_PUBLIC_ENVIRONMENT`: development

### Staging (.env.staging)
- `NEXT_PUBLIC_API_BASE_URL`: Staging API endpoint
- `NEXT_PUBLIC_ENVIRONMENT`: staging

### Production (.env.production)
- `NEXT_PUBLIC_API_BASE_URL`: Production API endpoint
- `NEXT_PUBLIC_ENVIRONMENT`: production

### Common Variables
- `NEXT_PUBLIC_API_TIMEOUT`: API request timeout in milliseconds (default: 10000)
- `NEXT_PUBLIC_ENABLE_BOOKING`: Enable/disable booking functionality (default: true)
- `NEXT_PUBLIC_ENABLE_SEARCH`: Enable/disable search functionality (default: true)
- `NEXT_PUBLIC_CACHE_TTL`: Cache time-to-live in minutes (default: 5)
- `NEXT_PUBLIC_GA_ID`: Google Analytics ID (optional)

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy to Vercel:
```bash
vercel
```

3. For production deployment:
```bash
vercel --prod
```

### Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Build the application:
```bash
npm run build
```

3. Deploy to Netlify:
```bash
netlify deploy --prod
```

### AWS S3 + CloudFront

1. Build the application:
```bash
npm run build
```

2. Export static files:
```bash
next export
```

3. Upload the `out/` directory to S3:
```bash
aws s3 sync out/ s3://your-bucket-name
```

4. Configure CloudFront distribution to point to the S3 bucket

### Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t famousgates-landing .
docker run -p 3001:3001 famousgates-landing
```

## API Integration

The landing page integrates with the main hotel management system through these endpoints:

### Hotel Data
- `GET /api/public/hotels` - List all hotel properties
- `GET /api/public/hotels/:id` - Get hotel details
- `GET /api/public/hotels/:id/rooms` - Get available rooms
- `GET /api/public/hotels/:id/promotions` - Get promotional offers

### Booking
- `POST /api/public/bookings` - Create new booking
- `GET /api/public/bookings/:reference` - Get booking details

### Search
- `GET /api/public/search/hotels?q=:query` - Search hotels
- `GET /api/public/search/rooms?filters=:filters` - Filter rooms

## Performance Optimization

- **Caching**: React Query caches API responses for 5 minutes
- **Lazy Loading**: Images below the fold are lazy loaded
- **Code Splitting**: Route-based code splitting with Next.js
- **Image Optimization**: Next.js Image component for automatic optimization
- **Static Generation**: Static pages generated at build time where possible

## Error Handling

- Automatic retry with exponential backoff (up to 3 retries)
- Graceful degradation with cached data when API is unavailable
- User-friendly error messages with retry options
- Error logging to monitoring service

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Android Chrome)

## Versioning

This landing page follows semantic versioning (SemVer) independent of the main hotel management system.

Current version: **1.0.0**

## Contributing

This is an internal project for FamousGates Hotels. For questions or issues, contact the development team.

## License

Proprietary - FamousGates Hotels

## Support

For technical support or questions:
- Email: dev@famousgateshotels.com
- Internal Slack: #landing-page-support
