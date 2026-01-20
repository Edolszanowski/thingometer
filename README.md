# Christmas Parade Float Judging App

A complete mobile-first web application for Christmas Parade Float Judging built with Next.js 14+, TypeScript, TailwindCSS, and Neon PostgreSQL.

## 🎄 Features

- **Judge Flow**: Select identity, score floats with 5 categories (0-20 each), auto-save scores, review and submit
- **Admin Dashboard**: View category winners, judge completion status, export scores to CSV
- **Coordinator Flow**: Manage float positions and order before/during the parade
- **Mobile-First**: Touch-friendly interface optimized for mobile devices
- **Christmas Theme**: Festive red, green, and gold color scheme
- **Real-time Scoring**: Instant auto-save as judges adjust sliders
- **Quick Navigation**: Jump between floats easily with horizontal scroll bar (maintains scored state)

## 🛠 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM
- **Deployment**: Vercel-ready

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Neon PostgreSQL account (free tier available)
- Git (for version control)

## 🚀 Local Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd christmas-parade-judging
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp .env.example .env.local
```

Or create `.env.local` manually and add your values:

```env
DATABASE_URL=your_neon_connection_string_here
ADMIN_PASSWORD=your_secure_admin_password_here
NEXT_PUBLIC_SITE_URL=https://Xmas.ithriveai.com
```

**Required Variables:**
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `ADMIN_PASSWORD` - Password for admin dashboard and coordinator access

**Optional Variables:**
- `NEXT_PUBLIC_SITE_URL` - Site URL for sitemap (defaults to https://judging.ithriveai.com, but set to https://Xmas.ithriveai.com for this project)

**Getting your Neon Database URL:**
1. Sign up/login at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. It should look like: `postgresql://user:password@host/database?sslmode=require`

### 4. Set Up the Database

Push the schema to your Neon database:

```bash
npm run db:push
```

Alternatively, generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 5. Seed Initial Data (Optional)

Populate the database with sample judges and floats:

```bash
npm run seed
```

This creates:
- 3 judges (Judge 1, Judge 2, Judge 3)
- 20 sample floats (expandable to 70+)

### 6. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
christmas-parade-judging/
├── app/
│   ├── judge/              # Judge selection
│   ├── floats/             # Float grid view
│   ├── float/[id]/         # Individual float scoring
│   ├── review/             # Review all scores
│   ├── submit/             # Submission confirmation
│   ├── admin/              # Admin dashboard
│   ├── coordinator/        # Coordinator float position management
│   ├── api/
│   │   ├── scores/         # Create/update scores
│   │   ├── judge/submit/   # Lock judge scores
│   │   ├── floats/         # Get all floats
│   │   ├── admin/          # Admin endpoints
│   │   └── coordinator/    # Coordinator endpoints
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                 # shadcn components
│   ├── JudgeSelector.tsx
│   ├── FloatCard.tsx
│   ├── FloatGrid.tsx
│   ├── ScoringSliders.tsx
│   ├── QuickJumpBar.tsx    # Maintains scored state across navigation
│   ├── SubmitButton.tsx
│   ├── AdminWinnerCard.tsx
│   ├── AdminJudgeStatus.tsx
│   └── BrandingFooter.tsx
├── lib/
│   ├── db.ts               # Database connection
│   ├── drizzle/
│   │   └── schema.ts       # Database schema
│   ├── cookies.ts          # Cookie management
│   ├── scores.ts           # Score utilities
│   └── utils.ts            # General utilities
├── scripts/
│   └── seed.ts             # Database seeding script
└── package.json
```

## 🗄 Database Schema

### Tables

- **judges**: Judge information and submission status
- **floats**: Float entries with organization and entry name
- **scores**: Individual scores with 5 categories (lighting, theme, traditions, spirit, music)

### Relationships

- One judge can score many floats (one-to-many)
- One float can be scored by many judges (one-to-many)
- Unique constraint on (judge_id, float_id)

## 🔐 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes | - |
| `ADMIN_PASSWORD` | Password for admin dashboard and coordinator access | Yes | - |
| `NEXT_PUBLIC_SITE_URL` | Site URL for sitemap and SEO | No | `https://Xmas.ithriveai.com` |

## 📱 User Flows

### Judge Flow

1. **Select Identity** (`/judge`): Choose Judge 1, 2, or 3
2. **View Floats** (`/floats`): See all floats in a grid (green = scored, gray = unscored)
3. **Score Float** (`/float/[id]`): Use sliders to score 5 categories (0-20 each)
   - Scores auto-save after 500ms of inactivity
   - Navigate with Previous/Next buttons or Quick Jump Bar
4. **Review Scores** (`/review`): View all scores in a table, highlight missing scores
5. **Submit** (`/submit`): Finalize and lock scores (cannot be undone)

### Admin Flow

1. **Login** (`/admin`): Enter admin password
2. **Dashboard** (`/admin/results`): View:
   - Category winners (Best Lighting, Theme, Traditions, Spirit, Music, Overall)
   - Judge completion status
   - Export all scores to CSV

## 🚢 GitHub Setup Instructions

### 1. Create a New Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `christmas-parade-judging` (or your preferred name)
3. Don't initialize with README (we already have one)

### 2. Initialize Git and Push

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Parade Management System"

# Add remote repository
git remote add origin https://github.com/yourusername/christmas-parade-judging.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## ☁️ Vercel Deployment Instructions

### 1. Connect GitHub Repository

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository you just pushed

### 2. Configure Project Settings

Vercel will auto-detect Next.js. Verify:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### 3. Add Environment Variables

In the Vercel project settings, add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `ADMIN_PASSWORD` | Your admin password |

**Important**: Use the same `DATABASE_URL` from your `.env.local` file.

### 4. Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Your app will be live at `https://your-project.vercel.app`

### 5. Run Database Migrations

After the first deployment, you need to run migrations on the production database:

**Option A: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment variables
vercel env pull .env.local

# Run migrations
npm run db:push
```

**Option B: Manual Migration**

1. Use the production `DATABASE_URL` from Vercel environment variables
2. Temporarily set it in your local `.env.local`
3. Run: `npm run db:push`
4. Remove the production URL from local `.env.local`

### 6. Seed Production Database (Optional)

If you want to seed the production database:

```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="your_production_connection_string"
npm run seed
```

## ✅ Post-Deployment Checklist

- [ ] Verify database migrations ran successfully
- [ ] Test judge flow: select judge, score a float, review, submit
- [ ] Test admin dashboard: login, view winners, export CSV
- [ ] Verify auto-save functionality works
- [ ] Test on mobile devices (responsive design)
- [ ] Verify all environment variables are set correctly
- [ ] Check that scores are being saved to database
- [ ] Test judge submission lock (cannot edit after submit)

## 🐛 Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct in Vercel environment variables
- Check that your Neon database is active (not paused)
- Ensure connection string includes `?sslmode=require`

### Build Errors

- Make sure all dependencies are in `package.json`
- Run `npm install` locally to verify dependencies
- Check Node.js version (requires 18+)

### Admin Access Issues

- Verify `ADMIN_PASSWORD` is set in Vercel
- Check that password matches what you're entering
- Clear browser cookies and try again

### Score Saving Issues

- Check browser console for errors
- Verify judge cookie is set (check Application > Cookies in DevTools)
- Ensure judge hasn't already submitted

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run seed` | Seed database with sample data |

## 🎨 Customization

### Adding More Floats

Edit `scripts/seed.ts` and add more entries to the `sampleFloats` array, or add them directly via SQL:

```sql
INSERT INTO floats (float_number, organization, entry_name) 
VALUES (21, 'Organization Name', 'Entry Name');
```

### Changing Colors

Edit `app/globals.css` to modify the Christmas color theme:

```css
:root {
  --christmas-red: #DC2626;
  --christmas-green: #16A34A;
  --christmas-gold: #F59E0B;
}
```

### Adjusting Auto-Save Delay

Edit `components/ScoringSliders.tsx` and change the debounce timeout:

```typescript
setTimeout(() => {
  saveScore({ lighting, theme, traditions, spirit, music })
}, 500) // Change 500 to your desired delay in milliseconds
```

## 📄 License

This project is created by iThrive AI™.

## 🤝 Support

For issues or questions, please check:
- Database connection: Verify Neon dashboard
- Environment variables: Check Vercel project settings
- Build logs: Check Vercel deployment logs

## 🎯 Cursor Instructions for Building

If using Cursor AI to scaffold this project:

1. **Initialize Project**: Create Next.js app with TypeScript
2. **Install Dependencies**: Add all packages from `package.json`
3. **Set Up Database**: Create schema, connection, and migrations
4. **Build Components**: Create all UI components with shadcn/ui
5. **Create Pages**: Implement all judge and admin pages
6. **Add API Routes**: Build all backend endpoints
7. **Style**: Apply Christmas theme and mobile-first design
8. **Test**: Verify all flows work correctly
9. **Deploy**: Push to GitHub and deploy to Vercel

---

**Created by iThrive AI™**

