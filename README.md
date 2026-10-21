# Perspective

**Match nonprofits and events with the brands, foundations and donors most likely to say yes**, and make the warm intro.

Think grant finder, but for sponsorships. It's two-sided, every match comes with its reasons, and every match ends in a drafted pitch or a double opt-in introduction.

![Home](docs/screenshots/home.png)

## What's in the prototype

| Flow | Route | What it does |
|---|---|---|
| Find sponsors | `/find` | An organization describes its event/program and gets ranked sponsors, why each fits, the suggested tier to ask for, and a drafted pitch. |
| Find causes | `/give` | A brand or donor describes its goals and gets ranked opportunities. |
| Import a pitch | `/import` | Paste a sponsorship email (and attach the PDF). It becomes a structured listing plus matches. |
| Listing | `/opportunities/[id]` | Listing details, tiers, every sponsor ranked; draft outreach or request an intro. |
| Sponsor | `/sponsors/[id]` | Sponsor profile and its best-fit opportunities. |
| Intros | `/intros` | Double opt-in intro pipeline: requested → opted in → introduced → won/passed. |

The seed data includes the real **EAGLES SOAR Aviation & STEM Expo 2026** listing (from the founder's outreach email and sponsorship package). All other listings and every sponsor are **fictional samples**, labeled "Sample" in the UI.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) for the product brief: problem, matching model, data strategy, business model and roadmap.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. This turns on Claude for pitch import, which reads PDFs and benefit grids much better. Without a key, import falls back to the built-in rule-based parser.

```bash
npm test           # matching, extraction and outreach unit tests (node:test)
npm run typecheck
npm run build
```

## How matching works

Scores (0–100) are the sum of six factors, each shown in the UI's "Score breakdown":

| Factor | Pts | Notes |
|---|---|---|
| Cause fit | 30 | Sponsor causes are priority-weighted; adjacent causes earn partial credit |
| Geography | 20 | Home metro > giving area > national |
| Budget | 15 | Picks the largest tier inside the sponsor's typical gift range |
| Audience | 15 | Who the event reaches vs. who the sponsor targets |
| Objectives | 15 | Infers what the package offers (talent pipeline, visibility, access…) from tier benefits |
| Timing | 5 | Event date vs. the sponsor's decision lead time |

The score then passes through these rules:
- **Blockers:** 501(c)(3)-only, excluded causes, past events → "Not eligible"
- **Relevance gate:** off-mission logistics are discounted
- **Core-cause cap:** "Excellent" requires hitting a core cause
- **Support mismatch:** −10

Code: [`lib/match.ts`](lib/match.ts).

## Layout

```
app/                 Next.js App Router pages and API routes
  api/extract        pitch → listing (Claude or rules)
  api/match          score a draft listing/profile without saving
  api/opportunities  save a listing
  api/sponsors       save a sponsor profile
  api/intros         create / update intro requests
components/          UI (forms, match cards, outreach drafts)
lib/
  taxonomy.ts        shared causes, audiences, objectives, regions
  match.ts           scoring engine
  extract.ts         rule-based pitch parser
  ai-extract.ts      Claude-based extraction (structured outputs)
  outreach.ts        pitch / opt-in / intro email drafts
  store.ts           prototype persistence (.data/db.json + seed)
data/seed.ts         EAGLES SOAR + fictional sample data
docs/                product brief and screenshots
```

Persistence is a JSON file for prototyping. `lib/store.ts` is the only module that touches storage, so swapping in Postgres is a contained change.
