# InsightScroll

A personalized wisdom feed — doomscroll-style learning powered by Grok, built with Next.js and Supabase.

## Stack

- **Next.js 15** (App Router, Server Actions)
- **Supabase** (Postgres, Auth, RLS)
- **Vercel** (hosting + Marketplace integrations)
- **Tailwind CSS v4**

## Quick start (local)

```bash
npm install
cp .env.example .env.local
# Fill in Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Create a Supabase project (or install the [Vercel Supabase integration](https://vercel.com/marketplace/supabase)).
2. Run the migration in **SQL Editor**:

   `supabase/migrations/001_initial_schema.sql`

3. Enable **Anonymous sign-ins**: Authentication → Providers → Anonymous → Enable.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Add the **Supabase** integration from the Vercel Marketplace — it auto-injects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. (Optional) Add `XAI_API_KEY` in Project Settings → Environment Variables for live Grok generation.
5. Deploy.

```bash
vercel link
vercel integration add supabase
vercel env pull .env.local
```

## Features

| Prototype | Production |
|-----------|------------|
| In-memory topics | Persisted in `topics` table |
| Simulated Grok posts | Server-side generation (xAI API or smart templates) |
| Local likes/saves | `post_interactions` + `saved_notes` tables |
| Single HTML file | Full Next.js app with auth + RLS |

## Project structure

```
src/
  app/           # Routes (feed, setup guide)
  components/    # UI from prototype
  lib/
    actions.ts   # Server Actions (CRUD + generation)
    grok.ts      # xAI API integration
    supabase/    # SSR client helpers
supabase/
  migrations/    # Database schema
prototype/
  index.html     # Original prototype (reference)
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `XAI_API_KEY` | No | xAI API key for live Grok generation |