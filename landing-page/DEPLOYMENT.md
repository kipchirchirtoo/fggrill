# Deployment Guide - FamousGates Hotels Landing Page

This guide provides step-by-step instructions for deploying the FamousGates Hotels landing page to various hosting platforms.

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All environment variables are configured correctly
- [ ] The main system API endpoints are accessible
- [ ] TypeScript compilation passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build completes successfully (`npm run build`)
- [ ] All tests pass (when implemented)

## Environment Variables

Ensure these environment variables are set for each environment:

### Required Variables
- `NEXT_PUBLIC_API_BASE_URL` - Main system API endpoint
- `NEXT_PUBLIC_ENVIRONMENT` - Environment name (development/staging/production)

### Optional Variables
- `NEXT_PUBLIC_API_TIMEOUT` - API timeout in milliseconds (default: 10000)
- `NEXT_PUBLIC_ENABLE_BOOKING` - Enable booking feature (default: true)
- `NEXT_PUBLIC_ENABLE_SEARCH` - Enable search feature (default: true)
- `NEXT_PUBLIC_CACHE_TTL` - Cache duration in minutes (default: 5)
- `NEXT_PUBLIC_GA_ID` - Google Analytics tracking ID

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the best integration with Next.js and automatic deployments.

#### Initial Setup

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Link the project:
```bash
cd landing-page
vercel link
```

#### Deploy to Staging

```bash
vercel
```

This creates a preview deployment with a unique URL.

#### Deploy to Production

```bash
vercel --prod
```

#### Configure Environment Variables in Vercel

1. Go to your project settings in Vercel dashboard
2. Navigate to "Environment Variables"
3. Add variables for each environment:
   - Production: Used for `vercel --prod`
   - Preview: Used for `vercel` (staging)
   - Development: Used locally

#### Automatic Deployments

Connect your Git repository to Vercel for automatic deployments:

1. Go to Vercel dashboard
2. Import your Git repository
3. Configure build settings:
   - Framework Preset: Next.js
   - Root Directory: `landing-page`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Option 2: Netlify

#### Initial Setup

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Initialize the site:
```bash
cd landing-page
netlify init
```

#### Deploy to Staging

```bash
npm run build
netlify deploy
```

#### Deploy to Production

```bash
npm run build
netlify deploy --prod
```

#### Configure Build Settings

Create `netlify.toml` in the landing-page directory:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### Environment Variables in Netlify

1. Go to Site settings > Build & deploy > Environment
2. Add environment variables for each deployment context:
   - Production
   - Deploy previews
   - Branch deploys

### Option 3: AWS S3 + CloudFront

For static export deployment to AWS.

#### Prerequisites

- AWS CLI installed and configured
- S3 bucket created
- CloudFront distribution configured

#### Build and Export

1. Update `next.config.js` to enable static export:
```javascript
module.exports = {
  output: 'export',
  // ... other config
};
```

2. Build and export:
```bash
npm run build
```

3. Upload to S3:
```bash
aws s3 sync out/ s3://your-bucket-name --delete
```

4. Invalidate CloudFront cache:
```bash
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

#### Automated Deployment Script

Create `deploy-aws.sh`:

```bash
#!/bin/bash
set -e

echo "Building application..."
npm run build

echo "Uploading to S3..."
aws s3 sync out/ s3://famousgates-landing-prod --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E1234567890ABC --paths "/*"

echo "Deployment complete!"
```

Make it executable:
```bash
chmod +x deploy-aws.sh
```

Run deployment:
```bash
./deploy-aws.sh
```

### Option 4: Docker

For containerized deployment to any platform.

#### Create Dockerfile

Already provided in README.md. Build and run:

```bash
# Build image
docker build -t famousgates-landing:latest .

# Run container
docker run -p 3001:3001 \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.famousgateshotels.com/api \
  -e NEXT_PUBLIC_ENVIRONMENT=production \
  famousgates-landing:latest
```

#### Deploy to Container Registry

```bash
# Tag for registry
docker tag famousgates-landing:latest registry.example.com/famousgates-landing:latest

# Push to registry
docker push registry.example.com/famousgates-landing:latest
```

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Landing Page

on:
  push:
    branches:
      - main
    paths:
      - 'landing-page/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        working-directory: ./landing-page
        run: npm ci
        
      - name: Type check
        working-directory: ./landing-page
        run: npm run type-check
        
      - name: Lint
        working-directory: ./landing-page
        run: npm run lint
        
      - name: Build
        working-directory: ./landing-page
        run: npm run build
        env:
          NEXT_PUBLIC_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          NEXT_PUBLIC_ENVIRONMENT: production
          
      - name: Deploy to Vercel
        working-directory: ./landing-page
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Post-Deployment Verification

After deployment, verify:

1. **Homepage loads correctly**
   - Visit the deployed URL
   - Check for console errors
   - Verify environment configuration displays correctly

2. **API connectivity**
   - Check browser network tab for API calls
   - Verify CORS is configured correctly
   - Test hotel data fetching

3. **Performance**
   - Run Lighthouse audit
   - Check page load time (should be < 3 seconds)
   - Verify images are optimized

4. **Responsive design**
   - Test on mobile devices
   - Test on tablets
   - Test on desktop

5. **Error handling**
   - Test with API unavailable
   - Verify error messages display correctly
   - Check retry functionality

## Rollback Procedure

### Vercel
```bash
# List deployments
vercel ls

# Promote a previous deployment
vercel promote <deployment-url>
```

### Netlify
```bash
# List deployments
netlify deploy:list

# Restore a previous deployment
netlify deploy:restore <deploy-id>
```

### AWS S3
Keep previous builds in a separate S3 bucket or folder, then sync back:
```bash
aws s3 sync s3://backup-bucket/previous-version/ s3://your-bucket-name --delete
```

## Monitoring

Set up monitoring for:

- **Uptime**: Use services like UptimeRobot or Pingdom
- **Performance**: Google Analytics, Vercel Analytics
- **Errors**: Sentry or similar error tracking
- **API Health**: Monitor API endpoint availability

## Troubleshooting

### Build Fails

1. Check Node.js version (should be 18+)
2. Clear cache: `rm -rf .next node_modules && npm install`
3. Check TypeScript errors: `npm run type-check`
4. Check environment variables are set

### API Connection Issues

1. Verify API URL is correct
2. Check CORS configuration on main system
3. Verify API endpoints are accessible
4. Check network tab in browser for error details

### Performance Issues

1. Check image optimization is enabled
2. Verify caching is working
3. Check bundle size: `npm run build` shows bundle analysis
4. Enable compression on hosting platform

## Support

For deployment issues:
- Check deployment logs in hosting platform
- Review error messages in browser console
- Contact DevOps team: devops@famousgateshotels.com
- Internal Slack: #landing-page-deployment
