# Munim: personal CFO app (`apps/web`)

Mobile-first Next.js app: mutual funds (CAS read on your device), bank and cards, subscriptions, loans, insurance, credit and a foundation-first plan, plus a voice agent (Hindi/English) over all of it. Signed out: the sample family. Signed in (phone OTP): your own data under row-level security.
Build spec, journey and screens: [docs/21](../../docs/21-munim-app-build.md) · Decisions D-024 to D-028 in [DECISIONS.md](../../DECISIONS.md). `apps/voice-cfo` is the frozen buildathon version.

## Run it
```bash
cd apps/web
npm install
cp .env.example .env.local   # all keys optional; see comments in the file
npm run dev                  # http://localhost:3001
npm test                     # engine, CAS parser (text + PDF), APIs, privacy
```

## Set up sign-in (Supabase), once
1. supabase.com → New project (Mumbai region if offered).
2. SQL editor → paste `supabase/migrations/0001_munim.sql` → Run. Creates the tables with row-level security.
3. Authentication → Providers → Phone: enable. For a demo with no SMS cost, add test numbers with fixed OTPs (if your plan offers it). For real SMS, connect an SMS provider (e.g. Twilio Verify); SMS to Indian numbers needs DLT compliance (⚠ verify before launch).
4. Project Settings → API: copy the Project URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (locally and in Vercel).

## Deploy (Vercel)
New Project → import `personal-cfo` → **Root Directory: `apps/web`** → add the env vars above → Deploy. Public `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

## How the data flows
| Data | Where it is read | What is stored |
|---|---|---|
| Mutual fund CAS (PDF + password) | In the browser (`lib/portfolio/pdf-lines.ts`, `cas.ts`) | Holdings only: scheme, ISIN, units, NAV, value, dated cash flows. No PAN, name, folio, email |
| Bank/card statements, SMS, emails, loan and policy papers | Server parsers (`lib/ingest`), mock data in the beta (D-020) | Parsed rows; document text redacted before saving |
| Actions (reminders, email drafts, plans) | Server tools, idempotent by content | `actions` table, per member |

Every number on screen comes from the same tools the voice agent uses (`/api/summary` → `lib/agent/tools.ts`), so what you see and what Munim says always match.

## Known gaps
- Expense-ratio gap for regular plans is an **estimate** (labelled on screen); AMFI TER data is not wired yet. No fund-overlap analysis yet.
- The CAS parser is tested on a synthetic CAMS-style statement and a PDF built from it; check it on a real CAS on your own machine before relying on it.
- Phone OTP needs an SMS provider and DLT registration for real Indian numbers.
