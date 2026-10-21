# Perspective

**Match any nonprofit with the brands, foundations and donors most likely to say yes**, and make the warm intro.

Think grant finder, but for sponsorships and corporate giving, across every cause and every kind of sponsor. It's two-sided, every match comes with its reasons, and every match ends in a drafted pitch or a double opt-in introduction.

![Home](docs/screenshots/home.png)

## What's in the prototype

| Flow | Route | What it does |
|---|---|---|
| Find sponsors | `/find` | An organization describes its event/program and gets ranked sponsors, why each fits, the suggested tier to ask for, and a drafted pitch. |
| Find causes | `/give` | A brand or donor describes its goals and gets ranked opportunities. |
| Import a pitch | `/import` | Paste any sponsorship email or one-pager (and attach the PDF). It becomes a structured listing plus matches. |
| Browse | `/opportunities`, `/sponsors` | Filter the network by cause, location, type and industry. |
| Listing | `/opportunities/[id]` | Listing details, tiers, every sponsor ranked; draft outreach or request an intro. |
| Sponsor | `/sponsors/[id]` | Sponsor profile and its best-fit opportunities. |
| Intros | `/intros` | Double opt-in intro pipeline: requested → opted in → introduced → won/passed. |

The demo network has 19 fictional organizations and 27 fictional sponsors, all labeled "Sample" in the UI:
- **Organizations:** food banks, animal rescues, youth sports, arts festivals, rural health, refugee services, recovery, disaster preparedness, adaptive sports and more, across 17 states plus one national virtual campaign.
- **Sponsors:** national brands, local businesses, foundations, individual donors and a public agency, across 20+ industries.

**Coverage**
- **Causes:** 36 cause areas in 8 groups, each mapped to an NTEE major group (the IRS nonprofit classification), so listings can later be checked against IRS records.
- **Sponsor industries:** 30, from pet products to professional services.

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
| Cause fit | 30 | Both sides' causes are priority-weighted; adjacent causes and the brand's industry (pet brand ↔ animal welfare) earn partial credit |
| Geography | 20 | Home metro > giving area > national |
| Budget | 15 | Picks the largest tier inside the sponsor's typical gift range |
| Audience | 15 | Who the event reaches vs. who the sponsor targets |
| Objectives | 15 | Infers what the package offers (talent pipeline, visibility, access…) from tier benefits |
| Timing | 5 | Event date vs. the sponsor's decision lead time |

The score then passes through these rules:
- **Blockers:** 501(c)(3)-only sponsors, causes a sponsor won't fund, sponsor industries an organization won't accept (e.g. a youth league declining alcohol or betting), past events → "Not eligible"
- **Out-of-area cap:** local and regional givers top out at 45 outside their giving area
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
  taxonomy.ts        causes (NTEE-mapped), audiences, objectives, industries, regions
  match.ts           scoring engine
  extract.ts         rule-based pitch parser
  ai-extract.ts      Claude-based extraction (structured outputs)
  outreach.ts        pitch / opt-in / intro email drafts
  store.ts           prototype persistence (.data/db.json + seed)
data/seed.ts         fictional sample network
data/examples.ts     example pitches for the import demo
docs/                product brief and screenshots
```

Persistence is a JSON file for prototyping. `lib/store.ts` is the only module that touches storage, so swapping in Postgres is a contained change.
