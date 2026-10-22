# Peep: product brief

> Get the right people in the room when it matters most.

## The problem

Sponsorship and corporate giving is a matching problem that's mostly run on hope and forwarded emails. It affects every kind of nonprofit, from food banks and animal shelters to youth leagues, arts festivals, health clinics and refugee services, and every kind of sponsor, from national brands to the bakery down the street.

**Organizations** write a good sponsorship package: a gala with table sponsorships, a 5K with mile markers, a youth season with jersey sponsors, a program needing an underwriter. Then they blast it to everyone they know and ask each recipient to "introduce us to companies or people who might want to partner." Most recipients don't know who fits, so the email dies in an inbox. Small organizations without a development team feel this most.

**Brands and donors** get dozens of these pitches. Few say which business goal the sponsorship serves (recruiting, local visibility, access to decision-makers, employee volunteering), so they're hard to compare and easy to ignore.

**Connectors** (board members, executives, community leaders) sit in the middle. They want to help, but each pitch forces them to work out who in their network fits, then write a careful intro. That work doesn't scale, so good opportunities go unmatched.

## Why Peep

**For brands.** Most corporate giving is planned around a budget and a tax year. Brands do care about causes, but the process around a gift (vetting, back-and-forth, chasing paperwork) is a headache, and it pushes them to perform interest they don't have time for. Peep keeps it simple:
1. Set the amount you plan to give.
2. Pick the causes, places and goals your brand actually cares about.
3. Peep matches you with campaigns that fit, moves the funds, and confirms they reached the organization.
4. The tax receipt arrives as soon as the transfer clears.

Afterwards, a brand can thank the team, schedule calls and stay in touch, or keep contact to what's strictly necessary. Peep is the intermediary either way.

**For nonprofits.** A small foundation's deck rarely matches the design polish of the enterprise brands it pitches. A great STEM program shouldn't lose a sponsor because its PDF looks homemade. Peep turns any deck, PDF or written pitch into the same standardized campaign, so every cause starts on a level playing field. Organizations can customize it and add copy and photos to make it more compelling, but nobody starts behind.

**Peep, the campaign manager.** A gremlin character guides organizations through the whole process: reading their PDF, flagging what's missing, nudging them toward posting, and celebrating pledges.

> Prototype status: transfers, fund verification and tax receipts are product direction, not built. Pledges are recorded commitments and record each sponsor's contact preference ("keep in touch" or "just the essentials").

## What Peep does

A grant finder for sponsorships, but two-sided and built around warm intros.

| | Grant finders (e.g. BrightHarbor, Instrumentl) | Peep |
|---|---|---|
| Who's matched | Applicant → public grant programs | Organization ↔ brands, foundations, individual donors |
| Source of supply | Published RFPs and grant databases | Sponsor profiles, imported pitches, connectors' networks |
| What a match means | "You're eligible" | "This sponsor gets what it wants from this event, here's the tier to ask for, here's why" |
| Next step | Apply | Tailored pitch or double opt-in warm intro |

### Core loops (all in this prototype)

1. **Find sponsors**: an organization describes its event or program (causes, audience, location, date, tiers, asks). It gets a ranked list of sponsors, each with the reasons it fits, what could get in the way, the suggested tier to ask for, and a drafted pitch.
2. **Find causes**: a brand or donor sets causes (in priority order), objectives, audience, giving area, typical gift size and lead time. It gets ranked opportunities.
3. **Import a pitch**: a connector pastes a pitch email and attaches the package PDF. Peep turns it into a structured listing, using Claude when an API key is set and a rule-based parser otherwise. It then shows who in the network should hear about it.
4. **Warm intro pipeline**: double opt-in. Ask the sponsor first, introduce once they say yes, then track the outcome: requested → opted in → introduced → won/passed.

## The campaign model (borrowed from crowdfunding)

Kickstarter and GoFundMe made raising money legible: a goal, a progress bar, clear rewards, and a single action. Sponsorship has none of that. It lives in PDFs and email threads. Peep uses the same structure:

| Crowdfunding | Peep |
|---|---|
| Project / fundraiser | Campaign: an event, program or appeal with a sponsorship goal |
| Rewards with limited quantities | Sponsorship tiers with slots (exclusive = 1, limited = 3, multiple = 10) |
| Backers pledge | Sponsors pledge to a tier; the organizer confirms and sends an agreement (no payments through us) |
| Progress bar, % funded, days to go | The same, counted to the event's start date |
| Discover by category, "nearly funded", "ending soon" | Discover by cause group, nearly funded, happening soon, just launched |
| Start a fundraiser in a few steps | Five-step "start a campaign" flow, or import an existing pitch |
| Recent donations as social proof | Recent pledges feed and ticker, plus each campaign's list of sponsors |

**What crowdfunding doesn't have, and Peep adds:**
- Every campaign lists its best-fit sponsors, the reasons, and the right tier to ask each one for.
- Pledges obey both sides' rules, so a sportsbook can't pledge to a youth league.

**Why goals and slots matter:** they create urgency ("2 of 3 left", "75% funded, 46 days to go") and let a sponsor see where their yes makes the biggest difference.

## Matching model

Explainable by design: every score is the sum of six inspectable factors plus named adjustments.

| Factor | Points | How it's scored |
|---|---|---|
| Cause fit | 30 | Both sides list causes in priority order; a hit on the sponsor's #1 and the organization's #1 counts most. Adjacent causes (e.g. food security ↔ poverty) get 40%. A brand's industry earns partial credit on causes it's naturally credible on (pet food ↔ animal welfare, insurer ↔ disaster preparedness). Fit = 70% best hit + 30% second-best. |
| Geography | 20 | Home metro > in giving area > national giver > same state outside local market > outside. |
| Budget | 15 | Finds the largest tier inside the sponsor's typical range and suggests it as the ask. Partial credit for a stretch (≤1.5×) or when every tier is below their usual gift. |
| Audience | 15 | Overlap between who the event reaches and who the sponsor targets. |
| Objectives | 15 | Reads tier benefits ("resume book access" → talent pipeline, "stage remarks" → thought leadership, "product sampling in adoption kits" → customer reach, "co-branded campaign" → cause marketing). |
| Timing | 5 | Is the event outside the sponsor's decision lead time? |

**Rules that keep it honest**
- **Hard blockers, both ways**: 501(c)(3)-only sponsors; causes a sponsor won't fund (a sportsbook that stays away from youth and recovery programs); industries an organization won't accept (a youth league declining alcohol, betting and tobacco, a river cleanup declining oil and gas); past events.
- **Out-of-area cap**: local and regional givers top out at 45 outside their giving area.
- **Relevance gate**: logistics only count fully when the cause fits. An in-budget, local, well-timed event that's off-mission is still a long shot.
- **Core-cause cap**: "Excellent" (85+) requires hitting one of the sponsor's core causes.
- **Support mismatch**: −10 when a sponsor's way of giving (e.g. media only) doesn't cover any of the asks.

Grades: Excellent ≥85 · Strong ≥70 · Possible ≥55 · Long shot <55.

**Later**: learn weights from outcomes (which intros convert to "won"), and add sponsor-side signals like past sponsorships, fiscal-year timing and category exclusivity conflicts.

## Where sponsor data comes from

This is the hardest part, and it's the moat.

1. **Self-serve profiles.** Brands and donors fill out "Find causes". Free, and they get curated deal flow instead of cold email.
2. **Connector networks.** A connector (you) adds the brands and people they know as private profiles. Matches surface "who in my network fits"; the sponsor never sees anything until they opt in.
3. **Every registered nonprofit.** The IRS Exempt Organizations Business Master File lists 1.5M+ tax-exempt organizations with EIN, location and NTEE code. Peep's causes map to NTEE groups, so a nonprofit can claim a pre-filled profile by EIN, and its 501(c)(3) status can be verified automatically.
4. **Public signals.** Past sponsor lists on event pages, CSR and community-giving pages, foundation 990-PF filings (grant amounts, geographies, causes), and corporate volunteer programs.
5. **The import loop.** Every pitch imported is a new listing. Every sponsor named on a package ("current partners include…") is a signal about who funds what.

## Who pays

| Segment | Free | Paid |
|---|---|---|
| Organizations | Unlimited matching on a draft listing; drafted pitches | Saved listings with alerts, full sponsor contact paths, multiple events, CRM export |
| Sponsors / donors | Profile and ranked deal flow | Team inbox, impact reporting across sponsorships, ESG export |
| Connectors | Import pitches, match against own network | "Super-connector" tier: shared network for a board, chamber or alumni group |

**Avoid success fees as a percentage of funds raised.** The Association of Fundraising Professionals' Code of Ethics prohibits percentage-based compensation, and many nonprofits and funders won't work with platforms that take one. Subscriptions or flat per-listing fees keep incentives clean.

## MVP → v1 roadmap

**Shipped in this prototype**
- Two-sided intake, explainable matching, suggested ask, drafted pitch / opt-in / intro emails
- Pitch import (Claude, with a rule-based fallback) for any kind of pitch: galas, 5Ks, seasons, programs
- 36 NTEE-mapped cause areas, 30 sponsor industries, industry fit and "won't accept" rules on both sides
- Fictional sample network: 19 organizations in 17 states and 27 sponsors across 20+ industries
- Filterable browse for opportunities and sponsors
- Intro pipeline with status tracking

- Campaign layer: goals, tier slots, pledges, Discover with category tabs and sorts, five-step campaign creation, sponsor "Backed" history

**Next (v1)**
- Accounts and roles (organization, sponsor, connector) with a private network per connector
- Real database (Postgres) and an email-forwarding address: forward a pitch to `pitch@…` and the listing appears
- Double opt-in sent from the platform, with sponsor-side "yes/no" links
- Alerts: "3 new opportunities match your profile"; "a new sponsor fits your listing"
- Outcome feedback → learned weights
- Sponsor enrichment from public data (990-PF, CSR pages, past sponsor lists)

**Later**
- Category exclusivity and conflict detection (two banks at one event)
- Impact reporting back to sponsors after the event
- Calendar view of the giving season by metro

## Metrics that matter

- **Intro → opted-in rate** (match quality from the sponsor's side)
- **Opted-in → won rate**, and dollars committed
- **Time from pitch received to first warm intro** (the connector's pain)
- Weekly active connectors, and imported pitches per connector

## Open questions

- **Who's the beachhead?** Connector-led (boards, chambers, alumni networks) grows supply and demand together, so this prototype leans that way. Organization-led is easier to sell but cold on supply.
- **Metro-first or cause-first rollout?** Density matters more than breadth: 200 sponsors in one metro beat 2,000 spread nationally. Alternatively, start with one cause vertical where brands already sponsor heavily (youth sports, hunger, animal welfare) and expand.
- **How much of a sponsor's profile is visible to organizations?** Default: organizations see fit and reasons, but contact paths only after opt-in.
