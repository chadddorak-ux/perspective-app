# Perspective

**Turn a nonprofit's pitch deck into a funded campaign.** Drop in a sponsorship PDF; Perspective builds the campaign, flags anything missing, then pairs it with brands and donors whose funds are verified and whose giving goals it meets.

Think grant finder, but for sponsorships and corporate giving, across every cause and every kind of sponsor. It's two-sided, every match comes with its reasons, and every match ends in a drafted pitch or a double opt-in introduction.

![Home](docs/screenshots/home.png)

## What's in the prototype

Perspective borrows the crowdfunding model from Kickstarter and GoFundMe:
- **Campaigns** have a goal, a progress bar and reward-style tiers.
- **Sponsors** pledge to a tier.
- **Discovery** works by category, with sorts like "Nearly funded".

The difference is that every campaign also shows which sponsors fit it and why.

The site speaks to nonprofits first: the hero is the PDF upload, and everything for sponsors sits in one "For sponsors" menu.

### PDF → campaign

1. **Read** (`lib/pdf-read.ts`): pdf.js runs in the browser and pulls out the text layer, the embedded photos (as JPEGs, largest first) and page previews. It loads on demand, and the same code runs in the single-file build.
2. **Fill**: the text goes to `/api/extract`. With `ANTHROPIC_API_KEY` set, Claude reads the PDF itself, which also handles scans and complex layouts. Without a key, the rule-based parser reads the text, including deck layouts: letter-spaced headings, "X is a 501(c)(3)" intros, and tier benefits listed under each tier.
3. **Check** (`lib/campaign-check.ts`): required gaps (organization, campaign name, pitch, cause, location, tiers, contact email, a future date for events) must be fixed before posting. Recommended ones (goal, with a suggestion from the tiers; EIN; cover photo; audience; story) are flagged but optional.
4. **Post**: the campaign saves with its cover and gallery photos, and opens with its best-fit sponsors.

![Review after reading a PDF](docs/screenshots/import-review.png)

| Flow | Route | What it does |
|---|---|---|
| Discover | `/opportunities` | Browse live campaigns by cause group, with filters and sorts: happening soon, nearly funded, just launched, most sponsors, biggest goals. |
| Campaign | `/opportunities/[id]` | Cover, story and funding stats ($ pledged of goal, % funded, sponsors, days to go). Tier cards show "X of Y left" and a pledge button. Below: best-fit sponsors with drafted outreach, and the list of sponsors who've pledged. |
| Start a campaign | `/find` | GoFundMe-style five-step flow (basics, causes, place and time, goal and tiers, asks), then a review with a card preview, matching sponsors, and launch. |
| Upload a pitch PDF | `/import` | Drop a sponsorship deck or one-pager. Peep reads the text and photos, fills in the campaign, flags what's missing (required gaps block posting), and posts it free. A sample deck is built in; pasting a pitch email still works. |
| For sponsors | `/give` | A brand or donor sets its goals and gets ranked campaigns with their funding progress and a "Back this campaign" action. |
| Sponsor profile | `/sponsors/[id]` | What a sponsor funds, the campaigns it has backed, and its best-fit campaigns. |
| Intros | `/intros` | Double opt-in intro pipeline: requested → opted in → introduced → won/passed. |

**Pledges are commitments, not payments.** The organizer confirms them and sends an agreement.

**Pledges follow the matching rules.** A sponsor in the network can't pledge to a campaign it's blocked from (a cause it excludes, or an industry the organization declines). Tiers also stop accepting pledges once their slots fill.

The featured campaign **EAGLES SOAR Aviation & STEM Expo 2026** is real. It's built from the Richard P. Hall Eagles Foundation's outreach email and sponsorship package, with no pledges recorded yet.

Everything else in the demo network is fictional and labeled "Sample" in the UI: 19 organizations and 29 sponsors.
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

Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. This turns on Claude for PDF import, which reads scanned pages and benefit grids much better. Without a key, PDFs are read in the browser and the rule-based parser fills in the campaign.

```bash
npm test           # matching, extraction and outreach unit tests (node:test)
npm run typecheck
npm run build
```

## Standalone HTML build

```bash
npm run build:static   # → out-static/perspective.html (one file, ~1 MB)
```

This produces the whole site as a single self-contained HTML file you can open by double-clicking. No server or install needed.

**What runs in the browser:**
- The same pages and components as the Next app.
- The same API route handlers, answered locally by a small fetch layer instead of a server.

**How it works:**
- Pages render through an in-memory router.
- Next-only modules are swapped for small browser stand-ins in `static/`.
- Anything a visitor creates (campaigns, pledges, intros) is saved in their browser's localStorage.

**Limitation:** PDF import reads in the browser and uses the rule-based parser here, because there's no server to hold an API key. Scanned PDFs (no text layer) still give you their photos, but the fields need filling in by hand.

The build also writes `out-static/artifact.html`, the same page without the `<html>`/`<head>`/`<body>` wrapper, for hosts that add their own.

## Design

The visual language is a storybook at dusk, inspired by [Passionfroot](https://www.passionfroot.me):
- **Pages and type:** cream paper pages, Fraunces with its soft-corner axis for headlines and Nunito Sans for UI, self-hosted through `@fontsource`.
- **Environments:** big rounded windows onto live 3D scenes built with three.js (`components/scene/`), each with a cream card rising out of its lower edge.
  - The hero is a starry night over drifting sunset clouds.
  - "Meet Peep" is a daytime cloudscape; the pledges section is a mountain forest at dusk.
  - Scenes load three.js on demand, pause off screen, render a single still frame under `prefers-reduced-motion`, and fall back to a painted CSS sky without WebGL.
- **Peep, the matchmaking gremlin:** a character built from primitives (`components/scene/gremlin.ts`).
  - It blinks, flicks its ears, follows the pointer, and waves.
  - In the hero it reacts to the demo: a wave when a campaign is posted, a look around while matching, and a jump with hearts when a pledge lands. Click it for a cheer.
  - A 2D version is the logo mark and favicon.
- **Glass bubble buttons:** every button is a frosted glass pill with a curved specular shine, a glint that follows the pointer, a soap-film rim that swirls on hover, a jelly squish on press and a pop ring on click (`app/globals.css`, `components/ButtonFX.tsx`).
- **Hero:** an animated three-step demo on real data. A nonprofit posts a campaign, Perspective scores the best-fit sponsors with reasons, and a sponsor pledges while the progress bar fills. It plays on its own, pauses on hover, and each step is clickable.
- **Campaign covers:** painted landscapes generated per cause group (sunrise hills, a calm sea, a village, a mountain forest, a night sky, dunes, a city, a planet), varied per campaign.
- **Themes and motion:** tokens live in `app/globals.css`, with light and dark themes. All motion respects `prefers-reduced-motion`.

![Home, dark](docs/screenshots/home-dark.png)

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
  api/pledges        pledge to a tier (slots and blockers enforced)
components/          UI (forms, match cards, outreach drafts)
lib/
  taxonomy.ts        causes (NTEE-mapped), audiences, objectives, industries, regions
  match.ts           scoring engine
  funding.ts         goals, pledges, tier slots, days to go
  extract.ts         rule-based pitch parser
  pdf-read.ts        in-browser PDF reading: text, photos, page previews
  campaign-check.ts  what a campaign still needs before it can post
  ai-extract.ts      Claude-based extraction (structured outputs)
  outreach.ts        pitch / opt-in / intro email drafts
  store-core.ts      store logic shared by both builds
  store.ts           server persistence (.data/db.json + seed)
static/              browser entry, router and Next stand-ins for the standalone build
scripts/             build-static.mjs
data/seed.ts         fictional sample network, goals and pledges
data/examples.ts     example pitches for the import demo
data/sample-deck.ts  a sample sponsorship deck PDF (fictional org) for "Try a sample deck"
docs/                product brief and screenshots
```

Persistence is a JSON file for prototyping. `lib/store.ts` is the only module that touches storage, so swapping in Postgres is a contained change.
