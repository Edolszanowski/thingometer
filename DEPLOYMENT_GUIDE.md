# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure these are set in Vercel:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require&channel_binding=require
ADMIN_PASSWORD=your_secure_password_here
NEXT_PUBLIC_SITE_URL=https://Xmas.ithriveai.com
```

### 2. Database Setup

1. **Run Migrations:**
   ```bash
   npm run db:push
   ```

2. **Seed Initial Data (if needed):**
   ```bash
   npm run seed
   ```

3. **Verify Database:**
   ```bash
   npm run test:db
   ```

### 3. Build Test

Test production build locally:

```bash
npm run build
npm run start
```

Visit `http://localhost:3000` and test all flows.

### 4. Security Review

- [ ] All environment variables are set
- [ ] Admin password is strong
- [ ] No sensitive data in code
- [ ] Security headers are configured
- [ ] HTTPS is enforced (Vercel does this automatically)

### 5. Performance Check

- [ ] Build completes successfully
- [ ] Bundle size is reasonable
- [ ] No console errors in production build
- [ ] Images are optimized
- [ ] Fonts are properly loaded

## Deployment Steps

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Production ready: Add security headers, error handling, SEO"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

### Step 3: Set Environment Variables

In Vercel project settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview, Development |
| `ADMIN_PASSWORD` | Your admin password | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://Xmas.ithriveai.com` | Production |

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Note the deployment URL

### Step 5: Run Database Migrations

After first deployment:

```bash
# Option A: Using Vercel CLI
npm i -g vercel
vercel env pull .env.local
npm run db:push

# Option B: Manual
# Temporarily set production DATABASE_URL in local .env.local
# Run: npm run db:push
```

### Step 6: Configure Custom Domain

1. In Vercel project → Settings → Domains
2. Add `judging.ithriveai.com`
3. Follow DNS configuration instructions
4. Wait for SSL certificate (automatic)

### Step 7: Post-Deployment Testing

Test all flows:
- [ ] Judge selection
- [ ] Float scoring (auto-save)
- [ ] Review page
- [ ] Score submission
- [ ] Admin login
- [ ] Admin dashboard
- [ ] CSV export
- [ ] Mobile responsiveness

## Post-Deployment Monitoring

### 1. Check Vercel Logs

- Monitor for errors
- Check response times
- Watch for failed requests

### 2. Monitor Database

- Check Neon dashboard for query performance
- Monitor connection pool usage
- Watch for slow queries

### 3. Error Tracking

Set up error tracking (recommended):
- **Sentry** (free tier available)
- **LogRocket**
- **Rollbar**

### 4. Analytics

Optional analytics setup:
- Google Analytics
- Plausible Analytics
- Vercel Analytics

## Rollback Plan

If issues occur:

1. **Vercel Rollback:**
   - Go to Deployments
   - Find last working deployment
   - Click "..." → "Promote to Production"

2. **Database Rollback:**
   - Use Neon point-in-time recovery
   - Or restore from backup

## Maintenance

### Regular Tasks

- [ ] Monitor error logs weekly
- [ ] Check database performance monthly
- [ ] Review and rotate admin password quarterly
- [ ] Update dependencies as needed
- [ ] Review security headers annually

### Updates

When updating:
1. Test locally first
2. Deploy to preview environment
3. Test thoroughly
4. Deploy to production
5. Monitor for issues

## Support

For issues:
1. Check Vercel deployment logs
2. Check Neon database logs
3. Review error tracking (if set up)
4. Check browser console for client errors

