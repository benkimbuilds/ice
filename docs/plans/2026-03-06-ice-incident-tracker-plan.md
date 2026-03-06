# ICE Incident Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack Next.js app to browse, search, and manage immigration enforcement incident reports with LLM-powered web scraping.

**Architecture:** Single Next.js 15 App Router app with SQLite via Prisma. Server actions for mutations, server components for rendering. Claude API for extracting structured data from scraped HTML. Single admin password auth via cookie.

**Tech Stack:** Next.js 15, Prisma, SQLite, Tailwind CSS v4, @anthropic-ai/sdk, iron-session

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `prisma/schema.prisma`
- Create: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `.env`, `.env.example`, `.gitignore`

**Step 1: Initialize Next.js project**

```bash
cd /Users/locke/code/play/ice
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Accept defaults. If it asks about overwriting, allow it (only data.csv and docs/ exist).

**Step 2: Install dependencies**

```bash
pnpm add prisma @prisma/client iron-session @anthropic-ai/sdk
pnpm add -D @types/node
```

**Step 3: Initialize Prisma with SQLite**

```bash
npx prisma init --datasource-provider sqlite
```

**Step 4: Create `.env` file**

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="changeme"
ANTHROPIC_API_KEY=""
SESSION_SECRET="a-random-32-char-string-change-me"
```

**Step 5: Create `.env.example`**

Same as `.env` but with empty/placeholder values.

**Step 6: Update `.gitignore`**

Add:
```
prisma/dev.db
prisma/dev.db-journal
.env
```

**Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with Prisma and deps"
```

---

### Task 2: Database Schema & Seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Modify: `package.json` (add seed script)
- Reference: `data.csv`

**Step 1: Define Prisma schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Incident {
  id           Int      @id @default(autoincrement())
  url          String   @unique
  altSources   String?
  date         String?
  location     String?
  headline     String?
  summary      String?
  incidentType String?
  country      String?
  status       String   @default("RAW")
  rawHtml      String?
  errorMessage String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Note: Using String for date (not DateTime) because many dates are partial (e.g., "10/9" with no year). Status is String enum: "RAW", "PROCESSING", "COMPLETE", "FAILED".

**Step 2: Generate Prisma client and push schema**

```bash
npx prisma db push
npx prisma generate
```

**Step 3: Create seed script**

`prisma/seed.ts`:
```typescript
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

// Install csv-parse first: pnpm add -D csv-parse tsx

const prisma = new PrismaClient();

async function main() {
  const csv = readFileSync("data.csv", "utf-8");
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let created = 0;
  let skipped = 0;

  for (const row of records) {
    const url = row.link?.trim();
    if (!url) {
      skipped++;
      continue;
    }

    const hasData = row.headline || row.summary || row.incident_type;

    try {
      await prisma.incident.upsert({
        where: { url },
        update: {},
        create: {
          url,
          altSources: row.alt_source || null,
          date: row.date || null,
          location: row.location || null,
          headline: row.headline || null,
          summary: row.summary || null,
          incidentType: row.incident_type || null,
          country: row.country_of_origin || null,
          status: hasData ? "COMPLETE" : "RAW",
        },
      });
      created++;
    } catch (e) {
      console.error(`Failed to insert ${url}:`, e);
      skipped++;
    }
  }

  console.log(`Seeded ${created} incidents, skipped ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

**Step 4: Install seed deps and configure**

```bash
pnpm add -D csv-parse tsx
```

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Step 5: Run seed**

```bash
npx prisma db seed
```

Expected: "Seeded 374 incidents, skipped 0"

**Step 6: Verify with Prisma Studio**

```bash
npx prisma studio
```

Spot-check a few rows. Close studio.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add database schema and CSV seed script"
```

---

### Task 3: Prisma Client Singleton & Shared Utilities

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/constants.ts`

**Step 1: Create Prisma singleton**

`src/lib/db.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 2: Create constants**

`src/lib/constants.ts`:
```typescript
export const INCIDENT_TAGS = [
  "3rd Country Deportation",
  "Court Process Issue",
  "DACA",
  "Death",
  "Deported",
  "Detained",
  "Detention Conditions",
  "LPR",
  "Minor/Family",
  "Native American",
  "Officer Misconduct",
  "Officer Use Of Force",
  "Protest / Intervention",
  "Raid",
  "Refugee/Asylum",
  "TPS",
  "U.S. Citizen",
  "Vigilante",
  "Visa / Legal Status",
] as const;

export const STATUS = {
  RAW: "RAW",
  PROCESSING: "PROCESSING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
} as const;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Prisma singleton and shared constants"
```

---

### Task 4: Global Layout & Styling

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/page.tsx` (placeholder)

**Step 1: Set up globals.css with Tailwind and custom fonts**

`src/app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --font-serif: "Georgia", "Times New Roman", serif;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --color-warm-50: #fafaf9;
  --color-warm-100: #f5f5f4;
  --color-warm-200: #e7e5e4;
  --color-warm-300: #d6d3d1;
  --color-warm-400: #a8a29e;
  --color-warm-500: #78716c;
  --color-warm-600: #57534e;
  --color-warm-700: #44403c;
  --color-warm-800: #292524;
  --color-warm-900: #1c1917;
}

body {
  font-family: var(--font-sans);
  color: var(--color-warm-900);
  background-color: var(--color-warm-50);
}

h1, h2, h3 {
  font-family: var(--font-serif);
}
```

**Step 2: Update layout.tsx**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICE Incident Tracker",
  description: "Documenting immigration enforcement incidents across the United States",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-warm-200">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <a href="/" className="block">
              <h1 className="text-2xl font-bold tracking-tight">
                ICE Incident Tracker
              </h1>
              <p className="text-sm text-warm-500 mt-1">
                Documenting immigration enforcement incidents
              </p>
            </a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-warm-200 mt-16">
          <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-warm-400">
            Data sourced from public reporting.
          </div>
        </footer>
      </body>
    </html>
  );
}
```

**Step 3: Create placeholder home page**

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <p>Coming soon.</p>;
}
```

**Step 4: Verify dev server runs**

```bash
pnpm dev
```

Open http://localhost:3000, verify layout renders.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add global layout and journalistic styling"
```

---

### Task 5: Public Browse Page — Server Component & Data Fetching

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/lib/queries.ts`
- Create: `src/components/incident-list.tsx`
- Create: `src/components/incident-card.tsx`
- Create: `src/components/search-filters.tsx`

**Step 1: Create query functions**

`src/lib/queries.ts`:
```typescript
import { prisma } from "./db";

export type IncidentFilters = {
  search?: string;
  tags?: string[];
  location?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function getIncidents(filters: IncidentFilters = {}) {
  const { search, tags, location, country, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  const where: any = {};
  const AND: any[] = [];

  if (search) {
    AND.push({
      OR: [
        { headline: { contains: search } },
        { summary: { contains: search } },
        { location: { contains: search } },
      ],
    });
  }

  if (tags && tags.length > 0) {
    AND.push({
      OR: tags.map((tag) => ({
        incidentType: { contains: tag },
      })),
    });
  }

  if (location) {
    AND.push({ location: { contains: location } });
  }

  if (country) {
    AND.push({ country: { contains: country } });
  }

  if (AND.length > 0) {
    where.AND = AND;
  }

  // Only show incidents that have at least a headline or summary for public view
  where.OR = [
    { headline: { not: null } },
    { summary: { not: null } },
    { incidentType: { not: null } },
  ];

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        url: true,
        date: true,
        location: true,
        headline: true,
        summary: true,
        incidentType: true,
        country: true,
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return { incidents, total, page, pageSize };
}

export async function getDistinctCountries(): Promise<string[]> {
  const results = await prisma.incident.findMany({
    where: { country: { not: null } },
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });
  return results.map((r) => r.country!).filter(Boolean);
}

export async function getDistinctLocations(): Promise<string[]> {
  const results = await prisma.incident.findMany({
    where: { location: { not: null } },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });
  return results.map((r) => r.location!).filter(Boolean);
}
```

**Step 2: Create search/filter component**

`src/components/search-filters.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { INCIDENT_TAGS } from "@/lib/constants";

export function SearchFilters({
  countries,
}: {
  countries: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("q") || "";
  const currentTags = searchParams.getAll("tag");
  const currentCountry = searchParams.get("country") || "";
  const currentDateFrom = searchParams.get("from") || "";
  const currentDateTo = searchParams.get("to") || "";

  const updateFilters = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (value === null || value === "") continue;
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }

      params.delete("page");
      startTransition(() => {
        router.push(`/?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const toggleTag = (tag: string) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    updateFilters({ tag: newTags.length > 0 ? newTags : null });
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search incidents..."
          defaultValue={currentSearch}
          onChange={(e) => {
            const value = e.target.value;
            // Debounce
            const timeout = setTimeout(() => {
              updateFilters({ q: value || null });
            }, 300);
            return () => clearTimeout(timeout);
          }}
          className="w-full px-4 py-2.5 border border-warm-300 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:border-warm-900 transition-colors"
        />
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        {INCIDENT_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1 text-xs font-medium border transition-colors ${
              currentTags.includes(tag)
                ? "bg-warm-900 text-white border-warm-900"
                : "bg-white text-warm-600 border-warm-300 hover:border-warm-500"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Country + Date filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={currentCountry}
          onChange={(e) => updateFilters({ country: e.target.value || null })}
          className="px-3 py-2 border border-warm-300 bg-white text-warm-700 text-sm focus:outline-none focus:border-warm-900"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={currentDateFrom}
          onChange={(e) => updateFilters({ from: e.target.value || null })}
          placeholder="From"
          className="px-3 py-2 border border-warm-300 bg-white text-warm-700 text-sm focus:outline-none focus:border-warm-900"
        />
        <input
          type="date"
          value={currentDateTo}
          onChange={(e) => updateFilters({ to: e.target.value || null })}
          placeholder="To"
          className="px-3 py-2 border border-warm-300 bg-white text-warm-700 text-sm focus:outline-none focus:border-warm-900"
        />

        {(currentSearch || currentTags.length > 0 || currentCountry || currentDateFrom || currentDateTo) && (
          <button
            onClick={() =>
              updateFilters({ q: null, tag: null, country: null, from: null, to: null })
            }
            className="px-3 py-2 text-sm text-warm-500 hover:text-warm-900 underline"
          >
            Clear all
          </button>
        )}
      </div>

      {isPending && (
        <div className="text-sm text-warm-400">Loading...</div>
      )}
    </div>
  );
}
```

**Step 3: Create incident card**

`src/components/incident-card.tsx`:
```tsx
"use client";

import { useState } from "react";

type Incident = {
  id: number;
  url: string;
  date: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  incidentType: string | null;
  country: string | null;
};

export function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);
  const tags = incident.incidentType
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean) || [];

  return (
    <article
      className="border-b border-warm-200 py-5 cursor-pointer hover:bg-warm-100/50 transition-colors px-2 -mx-2"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-semibold leading-tight">
            {incident.headline || "Untitled incident"}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-warm-500">
            {incident.date && <span>{incident.date}</span>}
            {incident.location && (
              <>
                {incident.date && <span aria-hidden>&middot;</span>}
                <span>{incident.location}</span>
              </>
            )}
            {incident.country && (
              <>
                <span aria-hidden>&middot;</span>
                <span>{incident.country}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-warm-100 text-warm-600 border border-warm-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {incident.summary && (
            <p className="text-sm text-warm-700 leading-relaxed">
              {incident.summary}
            </p>
          )}
          <a
            href={incident.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-block text-sm text-warm-900 underline hover:text-warm-600"
          >
            Read source article &rarr;
          </a>
        </div>
      )}

      {!expanded && incident.summary && (
        <p className="text-sm text-warm-500 mt-2 line-clamp-2">
          {incident.summary}
        </p>
      )}
    </article>
  );
}
```

**Step 4: Create incident list**

`src/components/incident-list.tsx`:
```tsx
import { IncidentCard } from "./incident-card";

type Incident = {
  id: number;
  url: string;
  date: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  incidentType: string | null;
  country: string | null;
};

export function IncidentList({
  incidents,
  total,
}: {
  incidents: Incident[];
  total: number;
}) {
  if (incidents.length === 0) {
    return (
      <div className="py-12 text-center text-warm-400">
        No incidents found matching your filters.
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-warm-400 mb-4">
        {total} incident{total !== 1 ? "s" : ""}
      </p>
      <div>
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Wire up the home page**

`src/app/page.tsx`:
```tsx
import { Suspense } from "react";
import { SearchFilters } from "@/components/search-filters";
import { IncidentList } from "@/components/incident-list";
import { getIncidents, getDistinctCountries } from "@/lib/queries";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tags = typeof params.tag === "string" ? [params.tag] : (params.tag as string[] | undefined);

  const [{ incidents, total }, countries] = await Promise.all([
    getIncidents({
      search: params.q as string,
      tags,
      country: params.country as string,
      dateFrom: params.from as string,
      dateTo: params.to as string,
    }),
    getDistinctCountries(),
  ]);

  return (
    <>
      <Suspense fallback={null}>
        <SearchFilters countries={countries} />
      </Suspense>
      <IncidentList incidents={incidents} total={total} />
    </>
  );
}
```

**Step 6: Verify**

```bash
pnpm dev
```

Open http://localhost:3000. Should see incident list with search and filters working.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add public browse page with search and tag filtering"
```

---

### Task 6: Admin Authentication

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/actions.ts`
- Create: `src/middleware.ts`
- Create: `src/app/admin/layout.tsx`

**Step 1: Create session utilities**

`src/lib/session.ts`:
```typescript
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  isAdmin: boolean;
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET!,
    cookieName: "ice-tracker-session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  });
}
```

**Step 2: Create login page**

`src/app/admin/login/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isAdmin) {
    redirect("/admin");
  }

  return (
    <div className="max-w-sm mx-auto mt-24">
      <h2 className="text-xl font-serif font-bold mb-6">Admin Login</h2>
      <LoginForm />
    </div>
  );
}
```

`src/app/admin/login/form.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-warm-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full px-4 py-2.5 border border-warm-300 bg-white focus:outline-none focus:border-warm-900"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 bg-warm-900 text-white font-medium hover:bg-warm-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
```

**Step 3: Create login action**

`src/app/admin/login/actions.ts`:
```typescript
"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export async function login(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get("password") as string;

  if (password !== process.env.ADMIN_PASSWORD) {
    return "Invalid password.";
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();

  redirect("/admin");
}
```

**Step 4: Create middleware to protect admin routes**

`src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: "ice-tracker-session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
    },
  });

  if (!session.isAdmin) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

**Step 5: Create admin layout**

`src/app/admin/layout.tsx`:
```tsx
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-warm-200">
        <h2 className="text-xl font-serif font-bold">Admin Dashboard</h2>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
```

`src/app/admin/logout-button.tsx`:
```tsx
"use client";

import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-warm-500 hover:text-warm-900 underline"
      >
        Log out
      </button>
    </form>
  );
}
```

`src/app/admin/actions.ts`:
```typescript
"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
```

**Step 6: Verify**

Visit http://localhost:3000/admin — should redirect to login. Enter the ADMIN_PASSWORD from .env, should land on admin dashboard.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add admin authentication with iron-session"
```

---

### Task 7: Admin Dashboard — Incident Table & CRUD

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/incidents/actions.ts`
- Create: `src/components/admin/incident-table.tsx`
- Create: `src/components/admin/add-incident-form.tsx`
- Create: `src/components/admin/edit-incident-modal.tsx`

**Step 1: Create admin server actions for CRUD**

`src/app/admin/incidents/actions.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");
}

export async function createIncident(formData: FormData) {
  await requireAdmin();
  const url = (formData.get("url") as string)?.trim();
  if (!url) throw new Error("URL is required");

  await prisma.incident.create({
    data: {
      url,
      headline: (formData.get("headline") as string)?.trim() || null,
      date: (formData.get("date") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      summary: (formData.get("summary") as string)?.trim() || null,
      incidentType: (formData.get("incidentType") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
      status: "RAW",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateIncident(id: number, formData: FormData) {
  await requireAdmin();

  await prisma.incident.update({
    where: { id },
    data: {
      url: (formData.get("url") as string)?.trim(),
      headline: (formData.get("headline") as string)?.trim() || null,
      date: (formData.get("date") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      summary: (formData.get("summary") as string)?.trim() || null,
      incidentType: (formData.get("incidentType") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteIncident(id: number) {
  await requireAdmin();
  await prisma.incident.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}
```

**Step 2: Create add incident form**

`src/components/admin/add-incident-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createIncident } from "@/app/admin/incidents/actions";

export function AddIncidentForm() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-warm-900 text-white text-sm font-medium hover:bg-warm-800 transition-colors"
      >
        + Add Incident
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setIsPending(true);
        try {
          await createIncident(formData);
          setOpen(false);
        } catch (e: any) {
          alert(e.message);
        } finally {
          setIsPending(false);
        }
      }}
      className="border border-warm-200 p-4 space-y-3 bg-white"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-warm-500 mb-1">URL *</label>
          <input name="url" required className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Headline</label>
          <input name="headline" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Date</label>
          <input name="date" placeholder="MM/DD/YYYY" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Location</label>
          <input name="location" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Incident Type</label>
          <input name="incidentType" placeholder="Detained, Officer Use Of Force" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Country</label>
          <input name="country" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-warm-500 mb-1">Summary</label>
          <textarea name="summary" rows={2} className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-warm-900 text-white text-sm font-medium hover:bg-warm-800 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-warm-500 hover:text-warm-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Create incident table with inline edit/delete**

`src/components/admin/incident-table.tsx`:
```tsx
"use client";

import { useState } from "react";
import { updateIncident, deleteIncident } from "@/app/admin/incidents/actions";
import { processIncident } from "@/app/admin/incidents/process-action";

type Incident = {
  id: number;
  url: string;
  date: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  incidentType: string | null;
  country: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RAW: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    COMPLETE: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-warm-100 text-warm-600"}`}>
      {status}
    </span>
  );
}

function EditRow({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  return (
    <tr className="bg-warm-50">
      <td colSpan={7} className="p-4">
        <form
          action={async (formData) => {
            setIsPending(true);
            try {
              await updateIncident(incident.id, formData);
              onClose();
            } finally {
              setIsPending(false);
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-500 mb-1">URL</label>
            <input name="url" defaultValue={incident.url} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-500 mb-1">Headline</label>
            <input name="headline" defaultValue={incident.headline || ""} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-500 mb-1">Date</label>
            <input name="date" defaultValue={incident.date || ""} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-500 mb-1">Location</label>
            <input name="location" defaultValue={incident.location || ""} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-500 mb-1">Incident Type</label>
            <input name="incidentType" defaultValue={incident.incidentType || ""} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-500 mb-1">Country</label>
            <input name="country" defaultValue={incident.country || ""} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-warm-500 mb-1">Summary</label>
            <textarea name="summary" defaultValue={incident.summary || ""} rows={3} className="w-full px-2 py-1.5 border border-warm-300 text-sm" />
          </div>
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={isPending} className="px-3 py-1.5 bg-warm-900 text-white text-sm disabled:opacity-50">
              {isPending ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-warm-500">
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-300 text-left">
            <th className="py-2 pr-3 font-medium text-warm-500">Status</th>
            <th className="py-2 pr-3 font-medium text-warm-500">Headline</th>
            <th className="py-2 pr-3 font-medium text-warm-500">Date</th>
            <th className="py-2 pr-3 font-medium text-warm-500">Location</th>
            <th className="py-2 pr-3 font-medium text-warm-500">Type</th>
            <th className="py-2 pr-3 font-medium text-warm-500">URL</th>
            <th className="py-2 font-medium text-warm-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) =>
            editingId === inc.id ? (
              <EditRow
                key={inc.id}
                incident={inc}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <tr key={inc.id} className="border-b border-warm-100 hover:bg-warm-50">
                <td className="py-2 pr-3">
                  <StatusBadge status={inc.status} />
                  {inc.status === "FAILED" && inc.errorMessage && (
                    <span className="block text-xs text-red-500 mt-0.5 max-w-32 truncate" title={inc.errorMessage}>
                      {inc.errorMessage}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 max-w-48 truncate" title={inc.headline || ""}>
                  {inc.headline || <span className="text-warm-300 italic">No headline</span>}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{inc.date || "—"}</td>
                <td className="py-2 pr-3 max-w-32 truncate">{inc.location || "—"}</td>
                <td className="py-2 pr-3 max-w-40 truncate" title={inc.incidentType || ""}>
                  {inc.incidentType || "—"}
                </td>
                <td className="py-2 pr-3 max-w-48 truncate">
                  <a href={inc.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                    {inc.url.replace(/https?:\/\/(www\.)?/, "").slice(0, 40)}...
                  </a>
                </td>
                <td className="py-2 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(inc.id)}
                      className="text-warm-500 hover:text-warm-900 text-xs underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        setProcessingId(inc.id);
                        try {
                          await processIncident(inc.id);
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      disabled={processingId === inc.id}
                      className="text-blue-600 hover:text-blue-800 text-xs underline disabled:opacity-50"
                    >
                      {processingId === inc.id ? "Processing..." : "Scrape"}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Delete this incident?")) {
                          await deleteIncident(inc.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 4: Create admin page**

`src/app/admin/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { IncidentTable } from "@/components/admin/incident-table";
import { AddIncidentForm } from "@/components/admin/add-incident-form";
import { CsvUploadForm } from "@/components/admin/csv-upload-form";

export default async function AdminPage() {
  const incidents = await prisma.incident.findMany({
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: incidents.length,
    raw: incidents.filter((i) => i.status === "RAW").length,
    complete: incidents.filter((i) => i.status === "COMPLETE").length,
    failed: incidents.filter((i) => i.status === "FAILED").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(stats).map(([label, count]) => (
          <div key={label} className="border border-warm-200 p-3">
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs text-warm-500 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 items-start">
        <AddIncidentForm />
        <CsvUploadForm />
      </div>

      {/* Table */}
      <IncidentTable incidents={incidents} />
    </div>
  );
}
```

**Step 5: Create CSV upload form (placeholder — wired up in Task 9)**

`src/components/admin/csv-upload-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { uploadCsv } from "@/app/admin/incidents/csv-action";

export function CsvUploadForm() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setIsPending(true);
        setResult(null);
        try {
          const msg = await uploadCsv(formData);
          setResult(msg);
        } catch (e: any) {
          setResult(`Error: ${e.message}`);
        } finally {
          setIsPending(false);
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        type="file"
        name="file"
        accept=".csv"
        className="text-sm text-warm-500 file:mr-2 file:px-3 file:py-1.5 file:border file:border-warm-300 file:bg-white file:text-sm file:font-medium file:text-warm-700 file:cursor-pointer hover:file:bg-warm-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 border border-warm-300 text-sm font-medium hover:bg-warm-50 disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload CSV"}
      </button>
      {result && <span className="text-sm text-warm-500">{result}</span>}
    </form>
  );
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add admin dashboard with incident table and CRUD"
```

---

### Task 8: Scraping & LLM Extraction Pipeline

**Files:**
- Create: `src/lib/scraper.ts`
- Create: `src/lib/extractor.ts`
- Create: `src/lib/pipeline.ts`
- Create: `src/app/admin/incidents/process-action.ts`

**Step 1: Create HTML scraper**

`src/lib/scraper.ts`:
```typescript
export async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ICEIncidentTracker/1.0; +research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Basic HTML to text extraction — strip tags, scripts, styles
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to ~15k chars to stay within Claude's context budget
    return cleaned.slice(0, 15000);
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: Create LLM extractor**

`src/lib/extractor.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_PROMPT = `You are a data extraction assistant. Given the text content of a news article or social media post about a U.S. immigration enforcement incident, extract the following fields. Return ONLY valid JSON with no markdown formatting.

{
  "headline": "A short headline summarizing the incident (max 15 words)",
  "date": "The date of the incident in M/D/YYYY format if available, otherwise null",
  "location": "City, State abbreviation (e.g. 'Chicago, IL') if available, otherwise null",
  "summary": "A 2-4 sentence factual summary of what happened",
  "incidentType": "Comma-separated tags from ONLY these options: Detained, Deported, Death, Detention Conditions, Officer Use Of Force, Officer Misconduct, Minor/Family, U.S. Citizen, Protest / Intervention, Raid, Refugee/Asylum, DACA, Visa / Legal Status, LPR, TPS, Court Process Issue, 3rd Country Deportation, Native American, Vigilante",
  "country": "Country of origin of the affected person if mentioned, otherwise null"
}

Rules:
- Only use tags from the provided list. Use multiple comma-separated tags when applicable.
- If you cannot determine a field, set it to null.
- The summary should be factual and neutral in tone.
- For the date, extract the date the incident occurred (not the article publication date) if possible.
- Return ONLY the JSON object, no other text.`;

export type ExtractedData = {
  headline: string | null;
  date: string | null;
  location: string | null;
  summary: string | null;
  incidentType: string | null;
  country: string | null;
};

export async function extractFromText(
  text: string,
  url: string
): Promise<ExtractedData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `URL: ${url}\n\nArticle text:\n${text}`,
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Parse JSON — handle potential markdown wrapping
  let jsonStr = content.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  return {
    headline: parsed.headline || null,
    date: parsed.date || null,
    location: parsed.location || null,
    summary: parsed.summary || null,
    incidentType: parsed.incidentType || null,
    country: parsed.country || null,
  };
}
```

**Step 3: Create pipeline that ties scraper + extractor + DB**

`src/lib/pipeline.ts`:
```typescript
import { prisma } from "./db";
import { scrapeUrl } from "./scraper";
import { extractFromText } from "./extractor";

export async function processIncidentPipeline(incidentId: number) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) throw new Error("Incident not found");

  // Set processing status
  await prisma.incident.update({
    where: { id: incidentId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    // Step 1: Scrape
    const text = await scrapeUrl(incident.url);

    // Step 2: Extract via LLM
    const extracted = await extractFromText(text, incident.url);

    // Step 3: Merge — user-provided fields take priority
    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        rawHtml: text.slice(0, 50000), // store for reprocessing
        headline: incident.headline || extracted.headline,
        date: incident.date || extracted.date,
        location: incident.location || extracted.location,
        summary: incident.summary || extracted.summary,
        incidentType: incident.incidentType || extracted.incidentType,
        country: incident.country || extracted.country,
        status: "COMPLETE",
        errorMessage: null,
      },
    });
  } catch (error: any) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: "FAILED",
        errorMessage: error.message?.slice(0, 500) || "Unknown error",
      },
    });
    throw error;
  }
}
```

**Step 4: Create server action for processing**

`src/app/admin/incidents/process-action.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { processIncidentPipeline } from "@/lib/pipeline";

export async function processIncident(id: number) {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  await processIncidentPipeline(id);
  revalidatePath("/admin");
  revalidatePath("/");
}
```

**Step 5: Verify**

Set a real ANTHROPIC_API_KEY in .env. Go to admin dashboard, click "Scrape" on a RAW incident. Should populate fields and change status to COMPLETE.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add scraping and LLM extraction pipeline"
```

---

### Task 9: CSV Upload Action

**Files:**
- Create: `src/app/admin/incidents/csv-action.ts`

**Step 1: Create CSV upload server action**

`src/app/admin/incidents/csv-action.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { parse } from "csv-parse/sync";

export async function uploadCsv(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  const text = await file.text();
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  let created = 0;
  let skipped = 0;

  for (const row of records) {
    // Try common column name variations
    const url =
      row.link || row.url || row.URL || row.Link || row.source || "";
    if (!url.trim()) {
      skipped++;
      continue;
    }

    const hasData =
      row.headline || row.Headline || row.summary || row.Summary || row.incident_type || row.incidentType;

    try {
      await prisma.incident.upsert({
        where: { url: url.trim() },
        update: {},
        create: {
          url: url.trim(),
          altSources: row.alt_source || row.altSources || null,
          date: row.date || row.Date || null,
          location: row.location || row.Location || null,
          headline: row.headline || row.Headline || null,
          summary: row.summary || row.Summary || null,
          incidentType: row.incident_type || row.incidentType || null,
          country: row.country_of_origin || row.country || null,
          status: hasData ? "COMPLETE" : "RAW",
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");

  return `Imported ${created} incidents, skipped ${skipped}`;
}
```

Note: csv-parse is already a dev dependency from the seed script. Move it to regular dependencies:

```bash
pnpm add csv-parse
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add CSV upload functionality"
```

---

### Task 10: Auto-Process on Create

**Files:**
- Modify: `src/app/admin/incidents/actions.ts`

**Step 1: Update createIncident to trigger pipeline**

After the `prisma.incident.create()` call in `createIncident`, add a fire-and-forget pipeline trigger:

```typescript
// At top of file, add import:
import { processIncidentPipeline } from "@/lib/pipeline";

// After the create call, add:
const incident = await prisma.incident.create({ ... });

// Fire and forget — don't block the response
processIncidentPipeline(incident.id).catch((err) => {
  console.error(`Pipeline failed for incident ${incident.id}:`, err);
});
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: auto-trigger scraping pipeline on new incident creation"
```

---

### Task 11: Polish & Final Touches

**Files:**
- Various component refinements
- Create: `src/app/not-found.tsx`

**Step 1: Add pagination to public page**

Add a simple "Load more" or page navigation to `src/app/page.tsx` and `src/components/incident-list.tsx` using the `page` search param.

Add to `incident-list.tsx`:
```tsx
// After the incident list, add pagination
{total > incidents.length && (
  <div className="mt-8 text-center">
    <a
      href={`/?${new URLSearchParams({ ...currentParams, page: String(currentPage + 1) }).toString()}`}
      className="px-4 py-2 border border-warm-300 text-sm hover:bg-warm-50"
    >
      Load more
    </a>
  </div>
)}
```

**Step 2: Add a simple 404 page**

`src/app/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h2 className="text-2xl font-serif font-bold">Page not found</h2>
      <p className="mt-2 text-warm-500">
        <a href="/" className="underline hover:text-warm-900">
          Return home
        </a>
      </p>
    </div>
  );
}
```

**Step 3: Verify entire app**

1. `pnpm build` — should succeed with no errors
2. `pnpm start` — test production build
3. Test public page: search, filter tags, filter country, expand incidents
4. Test admin: login, add incident (verify auto-scrape), edit, delete, CSV upload
5. Test auth: logout, verify /admin redirects to login

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: polish UI and add pagination"
```
