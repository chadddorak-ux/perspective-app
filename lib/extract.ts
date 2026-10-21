// Rule-based parser that turns a pasted sponsorship pitch (email body, or text
// copied from a sponsorship PDF) into a draft Opportunity. It's the fallback
// when no AI key is configured, and every field it fills is user-editable.

import { US_STATES, type AudienceId, type CauseId, type IndustryId, type OrgTypeId, type SupportTypeId } from "./taxonomy.ts";
import type { Opportunity, Tier } from "./types.ts";

export type OpportunityDraft = Omit<Opportunity, "id" | "createdAt" | "source">;

export type ExtractResult = {
  draft: OpportunityDraft;
  method: "ai" | "rules";
  warnings: string[];
};

const CAUSE_KEYWORDS: [CauseId, RegExp][] = [
  ["early-childhood", /early childhood|pre-?k\b|preschool|toddler|infant|head start/i],
  ["education-literacy", /literacy|reading|tutor|school readiness|classroom|curriculum|teachers?\b/i],
  ["stem-education", /\bSTEM\b|science|engineering|robotics|\bmath|aviation|aerospace/i],
  ["youth-development", /youth|kids|teens?\b|grades?\s*\d|young people|after-?school|mentoring/i],
  ["college-access", /scholarship|college access|first-?gen|financial aid|university/i],
  ["health-wellness", /health|wellness|medical|nutrition|fitness|screening|clinic|vaccin/i],
  ["mental-health", /mental health|suicide|anxiety|depression|counseling|wellbeing/i],
  ["disease-research", /cancer|diabetes|alzheimer|autism|research|patients?\b|rare disease|cure/i],
  ["disability", /disabilit|adaptive|special needs|wheelchair|deaf|blind|special olympics/i],
  ["addiction-recovery", /addiction|recovery|substance|sobriety|opioid/i],
  ["food-security", /hunger|food bank|food pantry|meals|food insecurity|food drive/i],
  ["housing", /housing|homeless|affordable homes|habitat for/i],
  ["poverty", /poverty|low-income|human services|basic needs|emergency assistance/i],
  ["community-development", /community|neighborhood|revitaliz/i],
  ["disaster-relief", /disaster|hurricane|wildfire|flood|tornado|preparedness|relief/i],
  ["public-safety", /first responders|firefighter|police|public safety|\bEMS\b/i],
  ["environment", /environment|climate|sustainab|conservation|clean-?up|recycl|\brivers?\b|watershed|\bparks?\b|\btrees?\b/i],
  ["animal-welfare", /animal|pets?\b|adoption|rescue|shelter pets|wildlife|dogs?\b|cats?\b/i],
  ["arts-culture", /\barts?\b|music|theat|museum|cultur|dance|film|festival|artists?/i],
  ["sports-recreation", /sports?|athlet|tournament|\b5k\b|10k|marathon|golf|soccer|basketball|league/i],
  ["journalism-media", /journalism|newsroom|public radio|local news|reporters?/i],
  ["racial-equity", /racial equity|underrepresented|black|hispanic|latin[oax]|\bBIPOC\b|equity/i],
  ["women-girls", /\bgirls\b|\bwomen\b/i],
  ["lgbtq", /lgbt|queer|pride\b|transgender/i],
  ["immigrants-refugees", /immigra|refugee|asylum|new americans|newcomer/i],
  ["civil-rights", /civil rights|legal aid|justice|voting rights|advocacy/i],
  ["veterans-military", /veteran|military|service members|tuskegee|usaf|army|navy|marine|heroes/i],
  ["workforce-development", /career|workforce|job|credential|certification|internship|apprentice|hiring/i],
  ["financial-literacy", /financial literacy|money management|budgeting|personal finance|financial health/i],
  ["small-business", /small business|entrepreneur|startup|main street|pitch competition/i],
  ["technology-ai", /\bAI\b|artificial intelligence|coding|hackathon|software|computer science|\btech\b/i],
  ["digital-inclusion", /digital (?:divide|literacy|inclusion|equity)|broadband|devices|internet access/i],
  ["international", /international|global|developing countries|abroad|overseas/i],
  ["civic-engagement", /civic engagement|voter|democracy|get out the vote|census/i],
  ["faith-based", /church|faith|congregation|ministry|mosque|synagogue|temple/i],
  ["aging", /seniors?\b|older adults|aging|elder/i],
];

const AUDIENCE_KEYWORDS: [AudienceId, RegExp][] = [
  ["k5-students", /elementary|grades?\s*k|kindergarten|ages?\s*[4-9]\b/i],
  ["teen-students", /grades?\s*(6|7|8|9)\s*[–-]\s*12|middle school|high school|teens?\b|grades 6|ages?\s*\d{1,2}\s*[–-]\s*1[3-8]/i],
  ["young-adults", /young adults|college|university students|ages 18/i],
  ["families", /famil|parents/i],
  ["educators", /teachers|educators|school leaders|principals/i],
  ["professionals", /professionals|executives|industry leaders|business leaders|civic leaders/i],
  ["small-business-owners", /small business|entrepreneurs|business owners/i],
  ["women", /\bwomen\b/i],
  ["lgbtq", /lgbt|queer|transgender/i],
  ["people-with-disabilities", /disabilit|adaptive|special needs/i],
  ["immigrants", /immigra|refugee|newcomer/i],
  ["veterans", /veterans|service members/i],
  ["seniors", /seniors|older adults/i],
  ["patients", /patients|caregivers/i],
  ["underserved", /underserved|low-income|under-resourced|title i/i],
  ["rural", /\brural\b/i],
  ["sports-fans", /runners|athletes|golfers|sports fans|outdoor/i],
  ["arts-patrons", /patrons|art lovers|theatergoers|audiences/i],
  ["pet-owners", /pet owners|adopters|pet lovers/i],
  ["faith-communities", /congregation|church members|faith communit/i],
  ["general-public", /general public|open to the public|community members|free admission|admission is free/i],
];

const INDUSTRY_EXCLUSION_KEYWORDS: [IndustryId, RegExp][] = [
  ["alcohol", /alcohol|beer|liquor|wine|spirits/i],
  ["tobacco-cannabis", /tobacco|vap(e|ing)|cannabis|marijuana|nicotine/i],
  ["gaming-gambling", /gambling|betting|casino|sportsbook/i],
  ["firearms", /firearm|guns?\b|weapons/i],
  ["oil-gas", /fossil fuel|oil (?:and|&) gas|petroleum/i],
  ["restaurants", /fast food/i],
  ["pharma", /pharma/i],
];

// Common suburbs and neighborhoods mapped to their metro, for local matching.
const CITY_METRO: Record<string, string> = {
  homestead: "Miami", "miami beach": "Miami", hialeah: "Miami", "coral gables": "Miami", doral: "Miami",
  hollywood: "Fort Lauderdale", "st. petersburg": "Tampa", clearwater: "Tampa", kissimmee: "Orlando",
  brooklyn: "New York", queens: "New York", bronx: "New York", "jersey city": "New York", newark: "New York",
  oakland: "San Francisco", berkeley: "San Francisco", "san jose": "San Francisco", "palo alto": "San Francisco",
  "long beach": "Los Angeles", pasadena: "Los Angeles", "santa monica": "Los Angeles", anaheim: "Los Angeles",
  evanston: "Chicago", "oak park": "Chicago", cambridge: "Boston", somerville: "Boston",
  arlington: "Washington", alexandria: "Washington", bethesda: "Washington", "silver spring": "Washington",
  "fort worth": "Dallas", plano: "Dallas", irving: "Dallas", "the woodlands": "Houston", "sugar land": "Houston",
  "round rock": "Austin", mesa: "Phoenix", tempe: "Phoenix", scottsdale: "Phoenix", chandler: "Phoenix",
  aurora: "Denver", boulder: "Denver", lakewood: "Denver", bellevue: "Seattle", tacoma: "Seattle", redmond: "Seattle",
  "st. paul": "Minneapolis", "saint paul": "Minneapolis", decatur: "Atlanta", marietta: "Atlanta",
  camden: "Philadelphia", "ann arbor": "Detroit", dearborn: "Detroit", "kansas city": "Kansas City",
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const TIER_WORDS =
  /presenting|title|platinum|gold|silver|bronze|diamond|champion|visionary|innovation|pathway|impact|community|partner|patron|benefactor|supporter|friend|sponsor|level|tier|underwriter|table|hole|jersey|banner/i;

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseDates(text: string): { startDate?: string; endDate?: string } {
  // "Dec 11–12, 2026", "December 11 & 12, 2026", "March 3, 2027"
  const named = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*(?:[–—-]|&|and|to)\s*(\d{1,2}))?,?\s+(20\d\d)\b/i,
  );
  if (named) {
    const m = MONTHS[named[1].toLowerCase()];
    const y = Number(named[4]);
    const start = iso(y, m, Number(named[2]));
    return { startDate: start, endDate: named[3] ? iso(y, m, Number(named[3])) : undefined };
  }
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/);
  if (numeric) return { startDate: iso(Number(numeric[3]), Number(numeric[1]), Number(numeric[2])) };
  return {};
}

export function parseAmount(raw: string): number {
  const m = raw.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2]?.toLowerCase();
  return Math.round(unit === "k" ? n * 1000 : unit === "m" ? n * 1_000_000 : n);
}

const AMOUNT_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b/g;

export function parseTiers(text: string): Tier[] {
  const lines = text.split(/\r?\n/);
  const tiers: Tier[] = [];
  const seen = new Set<number>();
  const push = (name: string, amount: number) => {
    if (amount < 250 || seen.has(amount)) return;
    seen.add(amount);
    const clean = name.replace(/^[\s•*·\-–—]+/, "").replace(/[\s:–—\-|(]+$/, "").trim();
    tiers.push({ name: clean || `$${amount.toLocaleString("en-US")} level`, amount, benefits: [] });
  };

  lines.forEach((line, i) => {
    const amounts = line.match(AMOUNT_RE) ?? [];
    if (amounts.length >= 2) {
      // Column layouts from PDFs: a row of tier names above a row of amounts.
      for (let back = 1; back <= 6 && i - back >= 0; back++) {
        const cells = lines[i - back].trim().split(/\s{2,}|\t/).filter(Boolean);
        if (cells.length === amounts.length && cells.some((c) => TIER_WORDS.test(c))) {
          // Pair with an earlier row too when there are two header rows (e.g. "Gold" over "Pathway Level").
          const above = lines.slice(Math.max(0, i - back - 6), i - back).reverse()
            .map((l) => l.trim().split(/\s{2,}|\t/).filter(Boolean))
            .find((c) => c.length === amounts.length && c.some((x) => TIER_WORDS.test(x)));
          amounts.forEach((a, j) => push(above ? `${above[j]} — ${cells[j]}` : cells[j], parseAmount(a)));
          return;
        }
      }
      amounts.forEach((a) => push("", parseAmount(a)));
      return;
    }
    if (amounts.length === 1) {
      const before = line.slice(0, line.indexOf(amounts[0])).replace(/[:–—\-|•*]+\s*$/, "").trim();
      const prev = lines.slice(Math.max(0, i - 2), i).reverse().find((l) => l.trim());
      const name = TIER_WORDS.test(before) ? before : prev && TIER_WORDS.test(prev) && prev.length < 60 ? prev : before;
      if (name.length <= 80 && (TIER_WORDS.test(name) || /sponsor/i.test(line))) push(name, parseAmount(amounts[0]));
    }
  });
  return tiers.sort((a, b) => b.amount - a.amount);
}

function parseLocation(text: string): Opportunity["location"] {
  if (/\b(virtual|online|nationwide)\b/i.test(text) && !/\bin-person\b/i.test(text)) {
    const anyCity = text.match(/,\s*([A-Z]{2})\b/);
    if (!anyCity) return { virtual: true };
  }
  const abbr = Object.keys(US_STATES).join("|");
  const names = Object.values(US_STATES).join("|");
  const cityState = text.match(new RegExp(`\\b((?:[A-Z][A-Za-z.'-]+ ){0,2}[A-Z][A-Za-z.'-]+),\\s*(${abbr}|${names})\\b`));
  if (cityState) {
    const city = titleCase(cityState[1].trim());
    const st = cityState[2].length === 2 ? cityState[2] : stateCode(cityState[2]);
    return { city, state: st, metro: CITY_METRO[city.toLowerCase()] ?? city };
  }
  const venue = text.match(/\bat\s+(?:the\s+)?([A-Z][\w']+)(?:-([A-Z][\w']+))?\s+(Speedway|Stadium|Arena|Center|Park|Convention|Hall)/);
  const stateName = text.match(new RegExp(`\\b(${names})\\b`));
  const state = stateName ? stateCode(stateName[1]) : undefined;
  if (venue) {
    const city = venue[1];
    return { city, state, metro: CITY_METRO[city.toLowerCase()] ?? venue[2] ?? city };
  }
  return state ? { state } : {};
}

function stateCode(name: string): string | undefined {
  return Object.entries(US_STATES).find(([, n]) => n.toLowerCase() === name.toLowerCase())?.[0];
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function parseReach(text: string): { expectedReach?: number; reachNote?: string } {
  let best = 0;
  let note: string | undefined;
  const re = /(\d{1,3}(?:,\d{3})+|\d+)\s*\+?\s*(attendees|participants|guests|people|visitors|runners|golfers|volunteers|players|kids|children|members|students|families|seniors)/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    const isTotal = /attendees|participants|guests|people|visitors|runners|golfers|players|kids|children/i.test(m[2]);
    if (n > best && (isTotal || best === 0)) {
      best = n;
      const start = text.lastIndexOf("\n", m.index!) + 1;
      const end = text.indexOf("\n", m.index!);
      note = text.slice(start, end === -1 ? undefined : end).replace(/^[\s•*-]+/, "").trim();
    }
  }
  return best ? { expectedReach: best, reachNote: note } : {};
}

const ORG_SUFFIX =
  "Foundation|Fund|Alliance|Association|Society|Collective|Network|Coalition|Institute|Council|Club|Center|Centre|Project|Initiative|Inc\\.?|League|Academy|Trust|Partnership|Bank|Pantry|Rescue|Shelter|Ministries|Services|Theater|Theatre|Orchestra|Museum|Library|Clinic|Scouts|Soccer|Baseball|Basketball|Football|Sports|Conservancy|Fellowship|Mission|House|Works|Corps";

function parseOrg(text: string): string | undefined {
  const m = text.match(new RegExp(`\\b((?:[A-Z][\\w.'’&-]*\\s+){1,6}(?:${ORG_SUFFIX}))\\b`));
  return m?.[1].replace(/^(The|Our|A)\s+/, "").trim();
}

const EVENT_WORDS =
  "Expo|Summit|Festival|Gala|Conference|Fair|Hackathon|Walk|Run|5K|10K|Tournament|Camp|Challenge|Showcase|Classic|Luncheon|Breakfast|Dinner|Banquet|Auction|Day|Week|Weekend|Bootcamp|Symposium|Forum|Ride|Drive|Telethon|Season|Concert|Tour|Program|Campaign|Initiative";

// "We're hosting Home for the Holidays, a free…": a capitalized name after an announcing verb.
const NAMED_AFTER_VERB = new RegExp(
  "(?:hosting|presents?|presenting|announcing|invite you to|join us (?:for|at))\\s+(?:the\\s+|our\\s+)?" +
    "([A-Z0-9][\\w&'’.-]*(?:\\s+(?:(?:for|of|the|and|in|on|at|to|a)\\s+)*[A-Z0-9][\\w&'’.-]*){0,7})",
);

function parseTitle(text: string): string | undefined {
  const m = text.match(new RegExp(`((?:[A-Z0-9&][\\w&'’.-]*\\s+){1,7}(?:${EVENT_WORDS}))(\\s+20\\d\\d)?\\b`));
  if (!m) return text.match(NAMED_AFTER_VERB)?.[1];
  return (m[1] + (m[2] ?? "")).replace(/^(The|Our|A|An|Annual)\s+/, "").replace(/\s+/g, " ").trim();
}

function parseExcludedIndustries(text: string): IndustryId[] {
  const clauses = text.match(/(?:do not|don't|cannot|can't|won't|will not|unable to) (?:accept|partner with|take)[^.\n]*|(?:no|excluding|except) (?:alcohol|tobacco|gambling|vap|cannabis|firearm|fossil|fast food)[^.\n]*/gi);
  if (!clauses) return [];
  const joined = clauses.join(" ");
  return INDUSTRY_EXCLUSION_KEYWORDS.filter(([, re]) => re.test(joined)).map(([id]) => id);
}

function parseAsks(text: string): SupportTypeId[] {
  const asks = new Set<SupportTypeId>();
  if (/sponsor|donat|underwrit|fund|contribut/i.test(text)) asks.add("cash");
  if (/in-kind|supplies|donate (?:goods|products|services)|product donations/i.test(text)) asks.add("in-kind");
  if (/pro bono|probono|legal help|accounting help|consulting/i.test(text)) asks.add("pro-bono");
  if (/matching gift|employer match|match(?:ing)? donations/i.test(text)) asks.add("matching");
  if (/volunteer/i.test(text)) asks.add("volunteers");
  if (/mentor|speaker|judge/i.test(text)) asks.add("mentors");
  if (/introduc|connect us|partner with|people who might/i.test(text)) asks.add("introductions");
  if (/media partner|promot|press|airtime/i.test(text)) asks.add("media");
  return [...asks];
}

function parsePartners(text: string): string[] {
  const out = new Set<string>();
  const list = text.match(/partners? (?:include|are|such as)\s+([^.\n]+)/i);
  if (list) list[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean).forEach((p) => out.add(p));
  const namePattern = "[A-Z][\\w.'’&-]*(?:\\s+(?:(?:of|and|for|the)\\s+)?[A-Z][\\w.'’&-]*){0,5}";
  for (const m of text.matchAll(new RegExp(`\\b(?:powered by|hosted by|in partnership with|aligned with)\\s+(?:the\\s+)?(${namePattern})`, "g"))) {
    const name = m[1].trim();
    if (name.length > 2) out.add(name);
  }
  return [...out].slice(0, 8);
}

function parseOrgType(text: string): OrgTypeId {
  if (/501\s*\(?c\)?\s*\(?3\)?/i.test(text)) return "501c3";
  if (/fiscal(ly)? sponsor/i.test(text)) return "fiscally-sponsored";
  if (/school district|public schools|PTA\b/i.test(text)) return "school";
  if (/nonprofit|non-profit|not-for-profit|charity|charitable|tax-deductible/i.test(text)) return "501c3";
  return "other";
}

function summarize(text: string): string {
  const sentences = text
    .replace(/\s+/g, " ")
    // Split on sentence ends, but not after initials or titles ("Capt. Richard P. Hall").
    .split(/(?<=[.!?])(?<!\b[A-Z]\.)(?<!\b(?:Capt|Mr|Mrs|Ms|Dr|St|Lt|Col|Gen|Sgt|Maj|Inc|Jr|Sr)\.)\s+/)
    .filter((s) => s.length > 40 && !/@|https?:|\$\d/.test(s));
  const ranked = sentences.filter((s) => /mission|event|expo|program|students|community|honors|free/i.test(s));
  return (ranked.length ? ranked : sentences).slice(0, 3).join(" ").slice(0, 600);
}

function parseEin(text: string): string | undefined {
  return text.match(/\b(?:EIN|Tax ID|Federal ID)[^\d]{0,20}(\d{2}-\d{7})\b/i)?.[1];
}

function matchAll<T extends string>(text: string, table: [T, RegExp][]): T[] {
  return table.filter(([, re]) => re.test(text)).map(([id]) => id);
}

// Orders matches by how often they come up, so the pitch's main cause comes first.
function rankByMentions<T extends string>(text: string, table: [T, RegExp][]): T[] {
  return table
    .map(([id, re], order) => ({ id, order, hits: text.match(new RegExp(re.source, "gi"))?.length ?? 0 }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .map((m) => m.id);
}

export function extractWithRules(text: string): ExtractResult {
  const warnings: string[] = [];
  const dates = parseDates(text);
  const tiers = parseTiers(text);
  const reach = parseReach(text);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const phone = text.match(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/)?.[0];
  const website = text
    .match(/(?<![@\w.])(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:org|com|co|net|io|us|edu)(?:\/[\w/-]*)?\b/i)?.[0];

  const causes = rankByMentions(text, CAUSE_KEYWORDS).slice(0, 5);
  const audiences = matchAll(text, AUDIENCE_KEYWORDS);
  const orgName = parseOrg(text);
  const title = parseTitle(text);

  if (!orgName) warnings.push("Couldn't find the organization name");
  if (!title) warnings.push("Couldn't find the event or program name");
  if (!dates.startDate) warnings.push("No date found — add one so sponsors can plan");
  if (!tiers.length) warnings.push("No sponsorship levels found — add tiers so we can match on budget");
  if (!causes.length) warnings.push("Couldn't infer causes — pick at least one");
  if (parseOrgType(text) === "other") warnings.push("Couldn't confirm 501(c)(3) status — set the organization type, since many sponsors require it");

  return {
    method: "rules",
    warnings,
    draft: {
      orgName: orgName ?? "",
      orgType: parseOrgType(text),
      ein: parseEin(text),
      title: title ?? "",
      kind: /campaign/i.test(text) ? "campaign" : dates.startDate ? "event" : "program",
      summary: summarize(text),
      causes,
      audiences: audiences.length ? audiences : ["general-public"],
      location: parseLocation(text),
      ...dates,
      ...reach,
      tiers,
      asks: parseAsks(text),
      excludedIndustries: parseExcludedIndustries(text),
      partners: parsePartners(text),
      contact: {
        email,
        phone,
        website: website && !website.startsWith("http") ? `https://${website}` : website,
      },
    },
  };
}
