# Human Impact Project

A living database documenting reported incidents of harm related to U.S. Immigration and Customs Enforcement operations.

Built with Next.js, SQLite (Prisma), and Claude API for automated data extraction.

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- An [Anthropic API key](https://console.anthropic.com/) (for the scraping pipeline)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file and fill in values
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="your-secure-password"
ANTHROPIC_API_KEY="sk-ant-..."
SESSION_SECRET="generate-a-random-32-char-string"
```

Generate a session secret:

```bash
openssl rand -hex 16
```

```bash
# Set up the database
npx prisma db push

# Seed with existing data (optional, imports data.csv)
npx prisma db seed

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

### Public site (`/`)

Browse, search, and filter incidents by keyword, location, incident type, person impacted, country of origin, and date range.

### Admin dashboard (`/admin`)

Login with the `ADMIN_PASSWORD` from your `.env` file.

- **Add incidents** -- Enter a URL (minimum) and optional fields. The scraping pipeline automatically fetches and extracts data from the URL using Claude AI.
- **Edit/delete** -- Inline editing for any incident field.
- **Re-scrape** -- Click "Scrape" on any row to re-run the extraction pipeline.
- **Scrape All Incomplete** -- Batch-process all RAW/FAILED rows.
- **CSV upload** -- Bulk import incidents from a CSV file. Expected columns: `link`, `date`, `location`, `headline`, `summary`, `incident_type`, `country_of_origin`.
- **Search/filter** -- Search across all fields and filter by status (RAW, COMPLETE, FAILED).

## Deploy

### Option A: VPS (recommended for SQLite)

Deploy to a VPS (Railway, Render, Fly.io, or a $5/mo DigitalOcean droplet):

```bash
# Build
pnpm build

# Start production server
pnpm start
```

The SQLite file lives at `prisma/dev.db`. Back it up periodically.

### Option B: Vercel + Turso

SQLite doesn't persist on Vercel's serverless functions (ephemeral filesystem). Use [Turso](https://turso.tech/) (SQLite over HTTP, generous free tier):

1. Create a Turso database
2. Install the driver: `pnpm add @libsql/client`
3. Update your `DATABASE_URL` to the Turso connection string
4. Deploy to Vercel

### Environment variables

Set these on your hosting platform:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite file path or Turso URL |
| `ADMIN_PASSWORD` | Password for the admin dashboard |
| `ANTHROPIC_API_KEY` | Anthropic API key for scraping |
| `SESSION_SECRET` | Random 32+ char string for session encryption |

## Project structure

```
src/
  app/
    page.tsx              # Public browse page
    layout.tsx            # Global layout (dark header)
    admin/
      page.tsx            # Admin dashboard
      login/              # Admin login
      incidents/          # Server actions (CRUD, scrape, CSV)
  components/
    search-filters.tsx    # Public search/filter UI
    incident-card.tsx     # Expandable incident card
    incident-list.tsx     # List with time range buttons
    admin/                # Admin-specific components
  lib/
    db.ts                 # Prisma client singleton
    queries.ts            # Database query functions
    scraper.ts            # HTML fetcher + metadata extractor
    extractor.ts          # Claude API structured extraction
    pipeline.ts           # Scrape + extract + save pipeline
    constants.ts          # Tags, statuses
    session.ts            # Auth session utilities
prisma/
  schema.prisma           # Database schema
  seed.ts                 # CSV seed script
data.csv                  # Source data
```

## Tech stack

- **Next.js** -- App Router, server components, server actions
- **Prisma + SQLite** -- Zero-config database
- **Tailwind CSS** -- Styling
- **Claude API** (Haiku) -- LLM-powered data extraction from scraped articles
- **iron-session** -- Encrypted cookie sessions for admin auth
