# Environment Variables Documentation

This document provides detailed information about all environment variables used in the FamousGates Hotels Landing Page.

## Overview

Environment variables are used to configure the landing page for different environments (development, staging, production) without changing code. All public environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

## Configuration Files

- `.env.development` - Local development configuration
- `.env.staging` - Staging environment configuration
- `.env.production` - Production environment configuration
- `.env.example` - Template with all available variables

## Required Variables

These variables MUST be set for the application to function correctly:

### NEXT_PUBLIC_API_BASE_URL
- **Type**: String (URL)
- **Required**: Yes
- **Description**: Base URL for the main hotel management system API
- **Examples**:
  - Development: `http://localhost:3000/api`
  - Staging: `https://staging-api.famousgateshotels.com/api`
  - Production: `https://api.famousgateshotels.com/api`
- **Notes**: Should NOT include trailing slash

### NEXT_PUBLIC_ENVIRONMENT
- **Type**: String (enum)
- **Required**: Yes
- **Description**: Current deployment environment
- **Valid Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Notes**: Used for conditional behavior and logging

## API Configuration

### NEXT_PUBLIC_API_TIMEOUT
- **Type**: Number (milliseconds)
- **Required**: No
- **Default**: `10000` (10 seconds)
- **Description**: Maximum time to wait for API responses
- **Recommended Values**:
  - Development: `10000`
  - Staging: `10000`
  - Production: `10000`
- **Notes**: Requests exceeding this timeout will be retried

### NEXT_PUBLIC_API_MAX_RETRIES
- **Type**: Number
- **Required**: No
- **Default**: `3`
- **Description**: Maximum number of retry attempts for failed API requests
- **Valid Range**: 0-5
- **Notes**: Uses exponential backoff between retries

### NEXT_PUBLIC_API_RETRY_DELAY
- **Type**: Number (milliseconds)
- **Required**: No
- **Default**: `1000` (1 second)
- **Description**: Initial delay before first retry attempt
- **Notes**: Delay doubles with each retry (exponential backoff)

## Feature Flags

### NEXT_PUBLIC_ENABLE_BOOKING
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable/disable booking functionality
- **Valid Values**: `true`, `false`
- **Use Cases**:
  - Disable during maintenance
  - Disable for testing without affecting bookings
  - Gradual rollout of booking features

### NEXT_PUBLIC_ENABLE_SEARCH
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable/disable search and filter functionality
- **Valid Values**: `true`, `false`
- **Use Cases**:
  - Disable if search API is unavailable
  - Testing without search functionality

## Cache Configuration

### NEXT_PUBLIC_CACHE_TTL
- **Type**: Number (minutes)
- **Required**: No
- **Default**: `5`
- **Description**: Time-to-live for cached hotel and room data
- **Recommended Values**:
  - Development: `1` (for testing)
  - Staging: `5`
  - Production: `5`
- **Notes**: 
  - Requirement 7.4 specifies 5 minutes
  - Lower values increase API calls but ensure fresher data
  - Higher values reduce API calls but may show stale data

## Image Configuration

### NEXT_PUBLIC_IMAGE_QUALITY
- **Type**: Number (percentage)
- **Required**: No
- **Default**: `85`
- **Description**: Quality level for optimized images
- **Valid Range**: 1-100
- **Recommended Values**:
  - Development: `75` (faster loading)
  - Staging: `85`
  - Production: `90` (higher quality)
- **Notes**: Higher values = better quality but larger file sizes

### NEXT_PUBLIC_ENABLE_IMAGE_OPTIMIZATION
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable Next.js automatic image optimization
- **Valid Values**: `true`, `false`
- **Notes**: Should always be `true` in production

## Performance Configuration

### NEXT_PUBLIC_ENABLE_LAZY_LOADING
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable lazy loading for images below the fold
- **Valid Values**: `true`, `false`
- **Notes**: 
  - Requirement 7.3 specifies lazy loading
  - Improves initial page load time

### NEXT_PUBLIC_PAGE_LOAD_TIMEOUT
- **Type**: Number (milliseconds)
- **Required**: No
- **Default**: `3000` (3 seconds)
- **Description**: Target maximum page load time
- **Notes**: 
  - Requirement 7.1 specifies 3 seconds
  - Used for performance monitoring and warnings

## Error Handling

### NEXT_PUBLIC_ENABLE_ERROR_LOGGING
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Enable error logging to monitoring service
- **Valid Values**: `true`, `false`
- **Recommended Values**:
  - Development: `true`
  - Staging: `true`
  - Production: `true`
- **Notes**: Should be enabled in all environments for debugging

### NEXT_PUBLIC_SHOW_ERROR_DETAILS
- **Type**: Boolean
- **Required**: No
- **Default**: `false` (production), `true` (development)
- **Description**: Show detailed error messages to users
- **Valid Values**: `true`, `false`
- **Recommended Values**:
  - Development: `true` (for debugging)
  - Staging: `true` (for testing)
  - Production: `false` (security)
- **Notes**: Never show stack traces or sensitive data in production

## Analytics (Optional)

### NEXT_PUBLIC_GA_ID
- **Type**: String
- **Required**: No
- **Default**: None
- **Description**: Google Analytics tracking ID
- **Format**: `G-XXXXXXXXXX` or `UA-XXXXXXXXX-X`
- **Example**: `G-ABC123DEF456`
- **Notes**: Leave empty to disable Google Analytics

### NEXT_PUBLIC_GTM_ID
- **Type**: String
- **Required**: No
- **Default**: None
- **Description**: Google Tag Manager container ID
- **Format**: `GTM-XXXXXXX`
- **Example**: `GTM-ABC1234`
- **Notes**: Leave empty to disable Google Tag Manager

## Monitoring (Optional)

### NEXT_PUBLIC_SENTRY_DSN
- **Type**: String (URL)
- **Required**: No
- **Default**: None
- **Description**: Sentry Data Source Name for error tracking
- **Format**: `https://[key]@[organization].ingest.sentry.io/[project]`
- **Example**: `https://abc123@o123456.ingest.sentry.io/789012`
- **Notes**: Leave empty to disable Sentry error tracking

## Environment-Specific Examples

### Development (.env.development)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_ENABLE_BOOKING=true
NEXT_PUBLIC_ENABLE_SEARCH=true
NEXT_PUBLIC_CACHE_TTL=1
NEXT_PUBLIC_IMAGE_QUALITY=75
NEXT_PUBLIC_SHOW_ERROR_DETAILS=true
```

### Staging (.env.staging)
```bash
NEXT_PUBLIC_API_BASE_URL=https://staging-api.famousgateshotels.com/api
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_ENABLE_BOOKING=true
NEXT_PUBLIC_ENABLE_SEARCH=true
NEXT_PUBLIC_CACHE_TTL=5
NEXT_PUBLIC_IMAGE_QUALITY=85
NEXT_PUBLIC_SHOW_ERROR_DETAILS=true
NEXT_PUBLIC_GA_ID=G-STAGING123
```

### Production (.env.production)
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.famousgateshotels.com/api
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_ENABLE_BOOKING=true
NEXT_PUBLIC_ENABLE_SEARCH=true
NEXT_PUBLIC_CACHE_TTL=5
NEXT_PUBLIC_IMAGE_QUALITY=90
NEXT_PUBLIC_SHOW_ERROR_DETAILS=false
NEXT_PUBLIC_GA_ID=G-PROD123456
NEXT_PUBLIC_SENTRY_DSN=https://abc@o123.ingest.sentry.io/456
```

## Security Best Practices

1. **Never commit sensitive data**: Use `.env.local` for secrets
2. **Use different values per environment**: Especially for API keys
3. **Validate required variables**: Application checks for required variables on startup
4. **Rotate credentials regularly**: Update API keys and tokens periodically
5. **Limit access**: Only authorized personnel should access production variables
6. **Use platform secrets**: Store sensitive variables in deployment platform (Vercel, Netlify)

## Troubleshooting

### Variable Not Found
- Ensure variable is prefixed with `NEXT_PUBLIC_`
- Restart development server after changing variables
- Check for typos in variable names

### Variable Not Updating
- Clear `.next` cache: `npm run clean`
- Restart development server
- Verify correct environment file is being used

### API Connection Issues
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check API server is running and accessible
- Verify CORS settings on API server
- Check network connectivity

### Build Failures
- Ensure all required variables are set
- Check for syntax errors in environment files
- Verify variable values are valid (no special characters that need escaping)

## Adding New Variables

When adding new environment variables:

1. Add to all environment files (`.env.development`, `.env.staging`, `.env.production`)
2. Add to `.env.example` with description
3. Update this documentation
4. Update `src/config/environment.ts` to expose the variable
5. Add validation if variable is required
6. Update deployment platform configuration
7. Document in code where variable is used

## References

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
