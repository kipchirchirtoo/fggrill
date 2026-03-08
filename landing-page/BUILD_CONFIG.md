# Build and Deployment Configuration

This document describes the build and deployment configuration for the FamousGates Hotels Landing Page.

## Overview

The landing page is configured for optimal performance, security, and independent deployment. It uses Next.js with advanced optimization features including:

- Image optimization with AVIF/WebP support
- Code splitting and bundle optimization
- Environment-specific configurations
- Security headers
- Responsive design support (320px - 2560px)

## Build Scripts

### Development
```bash
npm run dev
```
Starts the development server on port 3001 with hot reloading.

### Production Build
```bash
npm run build
```
Creates an optimized production build with:
- Type checking (prebuild)
- Linting (prebuild)
- Code minification
- Tree shaking
- Bundle optimization

### Start Production Server
```bash
npm run start
```
Starts the production server on port 3001.

### Linting
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
```

### Type Checking
```bash
npm run type-check
```
Runs TypeScript compiler without emitting files to check for type errors.

### Code Formatting
```bash
npm run format        # Format all files
npm run format:check  # Check formatting without changes
```

### Build Analysis
```bash
npm run build:analyze
```
Generates bundle analysis report to identify optimization opportunities.

### Static Export
```bash
npm run export
```
Creates a static HTML export for deployment to CDN/static hosting.

### Clean Build
```bash
npm run clean
```
Removes build artifacts and cache files.

## Environment Configuration

### Environment Files

- `.env.development` - Development environment (localhost)
- `.env.staging` - Staging environment
- `.env.production` - Production environment
- `.env.example` - Template for creating new environment files

### Environment Variables

#### API Configuration
- `NEXT_PUBLIC_API_BASE_URL` - Base URL for API endpoints (required)
- `NEXT_PUBLIC_API_TIMEOUT` - API request timeout in milliseconds (default: 10000)
- `NEXT_PUBLIC_API_MAX_RETRIES` - Maximum retry attempts for failed requests (default: 3)
- `NEXT_PUBLIC_API_RETRY_DELAY` - Delay between retries in milliseconds (default: 1000)

#### Environment
- `NEXT_PUBLIC_ENVIRONMENT` - Current environment (development/staging/production)

#### Feature Flags
- `NEXT_PUBLIC_ENABLE_BOOKING` - Enable/disable booking functionality (default: true)
- `NEXT_PUBLIC_ENABLE_SEARCH` - Enable/disable search functionality (default: true)

#### Cache Configuration
- `NEXT_PUBLIC_CACHE_TTL` - Cache time-to-live in minutes (default: 5)

#### Image Configuration
- `NEXT_PUBLIC_IMAGE_QUALITY` - Image quality for optimization (default: 85)
- `NEXT_PUBLIC_ENABLE_IMAGE_OPTIMIZATION` - Enable/disable image optimization (default: true)

#### Performance Configuration
- `NEXT_PUBLIC_ENABLE_LAZY_LOADING` - Enable/disable lazy loading (default: true)
- `NEXT_PUBLIC_PAGE_LOAD_TIMEOUT` - Page load timeout in milliseconds (default: 3000)

#### Error Handling
- `NEXT_PUBLIC_ENABLE_ERROR_LOGGING` - Enable/disable error logging (default: true)
- `NEXT_PUBLIC_SHOW_ERROR_DETAILS` - Show detailed error messages (default: false in production)

#### Analytics (Optional)
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID
- `NEXT_PUBLIC_GTM_ID` - Google Tag Manager ID

#### Monitoring (Optional)
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN for error monitoring

## Next.js Configuration

### Image Optimization

The landing page uses Next.js Image component with:
- Automatic format conversion (AVIF, WebP)
- Responsive image sizes
- 30-day cache TTL
- Support for high-resolution displays

Supported domains:
- localhost (development)
- famousgateshotels.com
- staging-api.famousgateshotels.com
- api.famousgateshotels.com

### Code Splitting

Optimized bundle splitting strategy:
- **Framework chunk**: React, React DOM, and core dependencies
- **React Query chunk**: Separate chunk for data fetching library
- **Library chunks**: Individual chunks for node_modules
- **Commons chunk**: Shared code used across multiple pages

### Security Headers

Production builds include security headers:
- Strict-Transport-Security (HSTS)
- X-Frame-Options (SAMEORIGIN)
- X-Content-Type-Options (nosniff)
- X-XSS-Protection
- Referrer-Policy
- DNS Prefetch Control

### Performance Optimizations

- SWC minification for faster builds
- Console removal in production
- CSS optimization
- Package import optimization
- Compression enabled

## Tailwind CSS Configuration

### Responsive Breakpoints

- `xs`: 320px (Mobile small)
- `sm`: 640px (Mobile large)
- `md`: 768px (Tablet)
- `lg`: 1024px (Desktop small)
- `xl`: 1280px (Desktop)
- `2xl`: 1536px (Desktop large)
- `3xl`: 2560px (Desktop extra large)

### Design System

- **Color Palette**: Primary, Secondary, and Accent colors with 50-900 shades
- **Typography**: Inter (sans), Georgia (serif), Playfair Display (display)
- **Animations**: Fade-in, slide-up, slide-down
- **Shadows**: Soft, medium, hard variants

### Plugins

- `@tailwindcss/forms` - Form styling utilities
- `@tailwindcss/typography` - Rich text styling
- `@tailwindcss/aspect-ratio` - Aspect ratio utilities

## Deployment

### Supported Platforms

1. **Vercel** (Recommended)
   - Automatic deployments from Git
   - Edge network distribution
   - Environment variable management

2. **Netlify**
   - Git-based deployments
   - CDN distribution
   - Form handling

3. **AWS S3 + CloudFront**
   - Static hosting on S3
   - CDN distribution via CloudFront
   - Custom domain support

### Deployment Steps

1. **Set Environment Variables**
   ```bash
   # Copy appropriate environment file
   cp .env.production .env
   ```

2. **Build the Application**
   ```bash
   npm run build
   ```

3. **Test Production Build Locally**
   ```bash
   npm run start
   ```

4. **Deploy to Platform**
   - Vercel: `vercel deploy --prod`
   - Netlify: `netlify deploy --prod`
   - AWS: Upload `.next` folder to S3 and configure CloudFront

### Environment-Specific Deployments

- **Development**: Automatic deployment on push to `develop` branch
- **Staging**: Automatic deployment on push to `staging` branch
- **Production**: Manual deployment or automatic on push to `main` branch

## Performance Targets

- Initial page load: < 3 seconds (broadband connection)
- Time to Interactive (TTI): < 5 seconds
- First Contentful Paint (FCP): < 1.5 seconds
- Largest Contentful Paint (LCP): < 2.5 seconds
- Cumulative Layout Shift (CLS): < 0.1

## Monitoring

### Build Monitoring

- Bundle size tracking
- Build time monitoring
- Dependency updates

### Runtime Monitoring

- Error tracking (Sentry)
- Performance metrics (Web Vitals)
- User analytics (Google Analytics)

## Troubleshooting

### Build Failures

1. **Type Errors**: Run `npm run type-check` to identify TypeScript issues
2. **Linting Errors**: Run `npm run lint:fix` to auto-fix common issues
3. **Dependency Issues**: Delete `node_modules` and run `npm install`

### Environment Issues

1. **Missing Variables**: Check `.env.example` for required variables
2. **API Connection**: Verify `NEXT_PUBLIC_API_BASE_URL` is correct
3. **CORS Errors**: Ensure API server allows landing page domain

### Performance Issues

1. **Large Bundle**: Run `npm run build:analyze` to identify large dependencies
2. **Slow Images**: Verify image optimization is enabled
3. **Cache Issues**: Clear `.next` folder and rebuild

## Maintenance

### Regular Tasks

- Update dependencies monthly
- Review bundle size after major updates
- Test on multiple browsers and devices
- Monitor error logs and performance metrics

### Version Management

The landing page uses semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes or major feature additions
- MINOR: New features, backward compatible
- PATCH: Bug fixes and minor improvements

Current version is tracked in `package.json`.
