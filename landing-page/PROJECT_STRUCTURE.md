# FamousGates Hotels Landing Page - Project Structure

## Overview

This document describes the complete project structure for the FamousGates Hotels landing page, an independently deployable web application built with Next.js and TypeScript.

## Directory Structure

```
landing-page/
├── public/                          # Static assets
│   ├── robots.txt                   # SEO robots configuration
│   └── .gitkeep                     # Placeholder for images and favicon
│
├── src/                             # Source code
│   ├── components/                  # React components (to be implemented)
│   │   └── .gitkeep
│   │
│   ├── pages/                       # Next.js pages
│   │   ├── _app.tsx                 # App wrapper with React Query provider
│   │   ├── _document.tsx            # HTML document structure
│   │   ├── index.tsx                # Homepage
│   │   └── .gitkeep
│   │
│   ├── services/                    # API integration services (to be implemented)
│   │   └── .gitkeep
│   │
│   ├── hooks/                       # Custom React hooks (to be implemented)
│   │   └── .gitkeep
│   │
│   ├── utils/                       # Utility functions
│   │   └── index.ts                 # Common utilities (formatting, validation, etc.)
│   │
│   ├── types/                       # TypeScript type definitions
│   │   └── index.ts                 # Core types (Hotel, Room, Booking, etc.)
│   │
│   ├── config/                      # Configuration
│   │   ├── environment.ts           # Environment variable configuration
│   │   └── .gitkeep
│   │
│   └── styles/                      # Global styles
│       └── globals.css              # Tailwind CSS and global styles
│
├── .env.development                 # Development environment variables
├── .env.staging                     # Staging environment variables
├── .env.production                  # Production environment variables
├── .eslintrc.json                   # ESLint configuration
├── .gitignore                       # Git ignore rules
├── next.config.js                   # Next.js configuration
├── package.json                     # Dependencies and scripts
├── postcss.config.js                # PostCSS configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration (strict mode)
├── DEPLOYMENT.md                    # Deployment guide
├── PROJECT_STRUCTURE.md             # This file
└── README.md                        # Setup and usage documentation
```

## Key Files and Their Purpose

### Configuration Files

- **package.json**: Defines project dependencies and npm scripts
  - Dependencies: React 18, Next.js 14, React Query, Axios, Tailwind CSS
  - Scripts: dev, build, start, lint, type-check

- **tsconfig.json**: TypeScript configuration with strict mode enabled
  - Strict type checking for better code quality
  - Path aliases (@/* for src/*)
  - Additional strict options: noUnusedLocals, noUnusedParameters, noImplicitReturns

- **next.config.js**: Next.js configuration
  - Image optimization settings
  - Performance optimizations (SWC minification)
  - Environment variable validation

- **tailwind.config.js**: Tailwind CSS configuration
  - Custom color palette (primary colors)
  - Extended screen sizes (xs to 2xl)
  - Custom font family (Inter)

### Environment Files

Three environment files for different deployment stages:

1. **.env.development**: Local development (API: localhost:3000)
2. **.env.staging**: Staging environment (API: staging-api.famousgateshotels.com)
3. **.env.production**: Production environment (API: api.famousgateshotels.com)

Each contains:
- API base URL
- API timeout
- Environment name
- Feature flags (booking, search)
- Cache TTL
- Analytics ID (optional)

### Source Code

#### Pages (src/pages/)

- **_app.tsx**: Application wrapper
  - React Query provider setup
  - Query client configuration (5-minute cache, 3 retries)
  - Global state management

- **_document.tsx**: HTML document structure
  - Meta tags for SEO
  - Font loading (Inter from Google Fonts)
  - Character encoding

- **index.tsx**: Homepage
  - Welcome message
  - Environment configuration display
  - Placeholder for hotel listings

#### Configuration (src/config/)

- **environment.ts**: Centralized environment configuration
  - Type-safe access to environment variables
  - Default values for all settings
  - Exported config object

#### Types (src/types/)

- **index.ts**: Core TypeScript types
  - Hotel, Room, Promotion
  - BookingRequest, BookingConfirmation
  - GuestInfo, ContactInfo
  - SearchFilters, ApiError, ApiResponse
  - PaginatedResponse

#### Utils (src/utils/)

- **index.ts**: Utility functions
  - Currency and date formatting
  - Email and phone validation
  - Debounce function for search
  - Date calculations
  - Text truncation
  - Query string parsing

#### Styles (src/styles/)

- **globals.css**: Global styles
  - Tailwind CSS imports
  - Custom scrollbar styles
  - Loading animations
  - Fade-in animations

### Documentation

- **README.md**: Comprehensive setup and usage guide
  - Installation instructions
  - Development workflow
  - Deployment options
  - API integration details
  - Performance optimization notes

- **DEPLOYMENT.md**: Detailed deployment guide
  - Pre-deployment checklist
  - Vercel deployment (recommended)
  - Netlify deployment
  - AWS S3 + CloudFront deployment
  - Docker deployment
  - CI/CD pipeline examples
  - Rollback procedures
  - Troubleshooting

- **PROJECT_STRUCTURE.md**: This file
  - Complete directory structure
  - File descriptions
  - Architecture overview

## Technology Stack

### Core Technologies

- **Next.js 14**: React framework with server-side rendering
- **React 18**: UI library
- **TypeScript 5.3**: Type-safe JavaScript
- **Tailwind CSS 3.4**: Utility-first CSS framework

### State Management & Data Fetching

- **React Query (TanStack Query) 5.17**: Server state management
  - Automatic caching (5 minutes)
  - Retry logic (3 attempts with exponential backoff)
  - Stale-while-revalidate pattern

### HTTP Client

- **Axios 1.6**: Promise-based HTTP client
  - Request/response interceptors
  - Timeout configuration
  - Error handling

### Development Tools

- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## Architecture Principles

### 1. Independent Deployment

- Completely separate from main hotel management system
- Own build and deployment pipeline
- Independent version numbering (SemVer)
- No shared dependencies with main system

### 2. API-First Integration

- All data fetched through REST API endpoints
- No direct database access
- HTTPS-only communication
- CORS configuration required on main system

### 3. Performance Optimization

- Server-side rendering with Next.js
- Automatic code splitting
- Image optimization
- Client-side caching (5 minutes)
- Lazy loading for below-the-fold content

### 4. Responsive Design

- Mobile-first approach
- Support for 320px to 2560px screens
- Touch-friendly UI (44px minimum tap targets)
- Tested on all major browsers

### 5. Error Resilience

- Automatic retry with exponential backoff
- Graceful degradation with cached data
- User-friendly error messages
- Error logging to monitoring service

## Next Steps

The following components need to be implemented in subsequent tasks:

1. **API Client Layer** (Task 3)
   - Base API client with retry logic
   - Hotels service
   - Booking service
   - Search service

2. **UI Components** (Task 4)
   - Layout components (Header, Footer, Navigation)
   - Hotel listing components
   - Hotel detail components
   - Room listing components
   - Booking flow components

3. **Search & Filter** (Task 5)
   - Search bar component
   - Filter panel component
   - Filter logic implementation

4. **Contact Information** (Task 6)
   - Contact section component
   - Click-to-call functionality
   - Click-to-email functionality

5. **Performance Optimizations** (Task 7)
   - Image optimization
   - Caching strategy
   - Bundle size optimization

6. **Error Handling** (Task 9)
   - Error boundary components
   - Offline behavior
   - Error messages

7. **Backend API Endpoints** (Task 11)
   - Public hotel data endpoints
   - Public booking endpoints
   - Public search endpoints

## Environment Configuration

### Development

```bash
npm run dev
```

Runs on http://localhost:3001
API: http://localhost:3000/api

### Staging

```bash
# Set environment
export NODE_ENV=staging
# or copy .env.staging to .env.local

npm run build
npm start
```

API: https://staging-api.famousgateshotels.com/api

### Production

```bash
# Set environment
export NODE_ENV=production
# or copy .env.production to .env.local

npm run build
npm start
```

API: https://api.famousgateshotels.com/api

## Scripts

- `npm run dev`: Start development server (port 3001)
- `npm run build`: Build for production
- `npm start`: Start production server (port 3001)
- `npm run lint`: Run ESLint
- `npm run type-check`: Run TypeScript type checking

## Dependencies

### Production Dependencies

- react: ^18.2.0
- react-dom: ^18.2.0
- next: ^14.0.4
- @tanstack/react-query: ^5.17.9
- axios: ^1.6.5

### Development Dependencies

- @types/node: ^20.10.6
- @types/react: ^18.2.46
- @types/react-dom: ^18.2.18
- typescript: ^5.3.3
- eslint: ^8.56.0
- eslint-config-next: ^14.0.4
- tailwindcss: ^3.4.0
- postcss: ^8.4.32
- autoprefixer: ^10.4.16

## Version

Current version: **1.0.0**

This version number is independent of the main hotel management system and follows semantic versioning (SemVer).

## Support

For questions or issues:
- Email: dev@famousgateshotels.com
- Internal Slack: #landing-page-support
