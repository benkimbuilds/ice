# ICE Incident Tracker — Design

## Architecture
Single Next.js 15 app (App Router) with SQLite via Prisma ORM. No separate backend — API routes and server actions handle all mutations. Deploy as a single process.

## Data Model
```
Incident {
  id            Int (auto-increment PK)
  url           String (unique, required)
  altSources    String? (semicolon-separated URLs)
  date          DateTime?
  location      String?
  headline      String?
  summary       String?
  incidentType  String? (comma-separated tags, e.g. "Detained, Minor/Family")
  country       String?
  status        Enum: RAW | PROCESSING | COMPLETE | FAILED
  rawHtml       String? (stored for reprocessing)
  errorMessage  String? (failure details)
  createdAt     DateTime
  updatedAt     DateTime
}
```

## Pages

### Public: `/`
- Search bar (full-text across headline, summary, location)
- Tag multi-select filter (OR logic)
- Location text filter
- Date range picker
- Country filter
- List view: headline, date, location, tags, truncated summary
- Click row to expand full summary + link to source

### Admin: `/admin/login`
- Single password login form
- Password from ADMIN_PASSWORD env var
- Sets HTTP-only secure session cookie

### Admin: `/admin`
- Table of all incidents with status column (RAW/PROCESSING/COMPLETE/FAILED)
- Add new incident (minimum: URL, optional: all other fields)
- Inline edit any field on any row
- Re-run scrape/extract button per row
- Bulk CSV upload
- Delete entries

## Scraping Pipeline
1. User submits URL (+ optional fields) via admin
2. Record created with status RAW
3. Server action fetches HTML via fetch()
4. Raw HTML stored on the record
5. HTML sent to Claude API with structured extraction prompt
6. Extracted fields: headline, date, location, summary, incidentType, country
7. Only empty fields are overwritten (user-provided data has priority)
8. Status set to COMPLETE or FAILED (with errorMessage)

Admin can re-trigger steps 3-7 on any record at any time.

## Auth
- Single shared admin password via ADMIN_PASSWORD env var
- Login page sets HTTP-only secure cookie
- Next.js middleware protects all /admin/* routes (except /admin/login)

## CSV Seed
- prisma db seed script reads data.csv
- Imports all rows preserving existing data
- Seeded rows with populated fields get status COMPLETE
- Rows with only a URL get status RAW

## Tech Stack
- Next.js 15 (App Router, server components, server actions)
- Prisma + SQLite
- Tailwind CSS v4
- Anthropic SDK (Claude API) for LLM extraction
- No other external dependencies

## Design Aesthetic
Minimal, high-contrast, journalistic. Black/white/warm gray palette. Serif headlines, sans-serif body. Generous whitespace. No decorative elements.
