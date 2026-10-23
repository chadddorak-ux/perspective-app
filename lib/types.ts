import type {
  AudienceId,
  CauseId,
  IndustryId,
  ObjectiveId,
  OrgTypeId,
  SponsorTypeId,
  SupportTypeId,
} from "./taxonomy.ts";

export type Location = {
  city?: string;
  state?: string; // two-letter code
  metro?: string; // e.g. "Miami", used for local matching
  virtual?: boolean;
};

export type Tier = {
  name: string;
  amount: number; // USD
  availability?: "exclusive" | "limited" | "multiple";
  slots?: number; // how many sponsors can take this tier; defaults from availability
  benefits: string[];
};

/** Something an organization is raising support for: an event, program or campaign. */
export type Opportunity = {
  id: string;
  orgName: string;
  orgType: OrgTypeId;
  ein?: string; // IRS employer identification number, NN-NNNNNNN
  title: string;
  kind: "event" | "program" | "campaign" | "general";
  summary: string; // the short blurb shown on cards
  story?: string; // longer campaign story
  goal?: number; // sponsorship goal in USD; suggested from tiers when absent
  causes: CauseId[];
  audiences: AudienceId[];
  location: Location;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string;
  expectedReach?: number; // attendees / participants
  reachNote?: string;
  tiers: Tier[];
  asks: SupportTypeId[];
  excludedIndustries: IndustryId[]; // sponsors the organization won't accept
  partners: string[];
  contact: { name?: string; email?: string; phone?: string; website?: string };
  coverImage?: string; // a JPEG/PNG data URL, often pulled from the pitch PDF
  gallery?: string[]; // more images from the PDF, shown on the campaign page
  /** Photos, numbers and a quote the organization lets its backers reuse in their own posts. */
  storyKit?: StoryKit;
  /** Who confirmed they may publish for the organization, and when. Pages never go live without it. */
  consent?: { by: string; at: string };
  source: "seed" | "import" | "intake";
  sample?: boolean;
  featured?: boolean; // pinned to the top of the home page and Discover
  createdAt: string;
};

export type StoryKit = {
  stats: { label: string; value: string }[];
  quote?: { text: string; by: string };
};

/**
 * A brand's asset vault: what a nonprofit it funds needs to recognize it
 * correctly, so nobody emails asking for "the logo, but as a vector".
 */
export type BrandKit = {
  /** SVG markup for the mark (square) and the wordmark (horizontal). */
  mark: string;
  wordmark: string;
  colors: { name: string; hex: string }[];
  /** A value-neutral line that's safe to print in a charitable acknowledgment. */
  tagline?: string;
  boilerplate: string;
  mission?: string;
  website?: string;
  photos?: string[]; // approved image data URLs
  rules: string[];
  /** Where the kit came from: drafted from public info, or edited by the brand. */
  origin: "drafted" | "brand";
  updatedAt?: string;
};

/** What a brand, foundation or donor wants to fund. */
export type SponsorProfile = {
  id: string;
  name: string;
  type: SponsorTypeId;
  industry?: IndustryId; // brands and businesses; foundations and individuals usually leave it empty
  about: string;
  causes: CauseId[];
  audiences: AudienceId[];
  objectives: ObjectiveId[];
  geography: {
    scope: "local" | "state" | "regional" | "national";
    states: string[];
    metros: string[];
  };
  budget: { min: number; max: number }; // typical single sponsorship / gift
  supportTypes: SupportTypeId[];
  leadTimeDays: number; // how far ahead they typically commit
  requires501c3: boolean;
  excludedCauses: CauseId[];
  approach: "open" | "intro-preferred" | "invite-only";
  brandKit?: BrandKit;
  /** Month (1–12) the brand's budget year ends, so asks land in the right window. */
  fiscalYearEnd?: number;
  /** A public giving commitment, shown as a Peep Pledge badge. */
  peepPledge?: { kind: "percent-profit" | "fixed"; value: number; since: string };
  /** Set aside ahead of time; sent to vetted local responders when a declared disaster hits. */
  disasterPool?: number;
  /** This year's giving budget. */
  givingBudget?: number;
  source: "seed" | "intake";
  sample?: boolean;
  createdAt: string;
};

export type MatchDimension =
  | "causes"
  | "geography"
  | "budget"
  | "audience"
  | "objectives"
  | "timing";

export type MatchResult = {
  score: number; // 0–100
  grade: "Excellent" | "Strong" | "Possible" | "Long shot" | "Not eligible";
  breakdown: { dimension: MatchDimension; score: number; max: number; note: string }[];
  adjustments: { label: string; points: number }[];
  reasons: string[];
  gaps: string[];
  blockers: string[];
  suggestedTier?: Tier;
};

export type IntroStatus = "requested" | "opted-in" | "introduced" | "won" | "passed";

export type IntroRequest = {
  id: string;
  opportunityId: string;
  sponsorId: string;
  score: number;
  note?: string;
  requestedBy: "organization" | "sponsor" | "connector";
  status: IntroStatus;
  createdAt: string;
  updatedAt: string;
};

/** The tier anyone can give to on any campaign: unrestricted money for running the organization. */
export const GENERAL_SUPPORT = "General operating support";

export type PlacementProof = { id: string; image: string; note?: string; status: "submitted" | "approved"; at: string };

/** A sponsor's commitment to a tier, like a backer pledging to a reward. */
export type Pledge = {
  id: string;
  opportunityId: string;
  sponsorId?: string; // set when the sponsor has a profile in the network
  sponsorName: string;
  tierName: string;
  amount: number;
  message?: string;
  /** What the sponsor wants after giving: to stay in touch, or just the confirmation and tax receipt. */
  contact?: "connect" | "essentials";
  /**
   * A gift gets a charitable acknowledgment and recognition limited to name and logo.
   * A sponsorship is invoiced by the nonprofit as a business expense and can carry fuller benefits.
   */
  kind?: "gift" | "sponsorship";
  /** Public (name and logo), private (the nonprofit knows, the page doesn't) or anonymous. */
  recognition?: "public" | "private" | "anonymous";
  /** Part of a giving circle: the share of the tier this pledge covers (e.g. 0.25). */
  share?: number;
  renews?: boolean;
  /** Peep's fee, paid by the sponsor on top so the nonprofit receives the full amount. */
  fee?: number;
  status: "pledged" | "confirmed";
  /** When the transfer reached the nonprofit, and when it acknowledged the gift. */
  clearedAt?: string;
  acknowledgedAt?: string;
  proofs?: PlacementProof[];
  /** The brand can close a nonprofit's access to its kit at any time. */
  kitRevoked?: boolean;
  createdAt: string;
};

export type PitchStatus = "sent" | "interested" | "declined";
export type DeclineReason = "outside-causes" | "outside-area" | "budget-spent" | "timing" | "not-now";

/** A nonprofit's ask, sent to a brand through its profile as a standard one-pager. */
export type Pitch = {
  id: string;
  opportunityId: string;
  sponsorId: string;
  note?: string;
  via: "profile" | "request-link";
  status: PitchStatus;
  reason?: DeclineReason;
  createdAt: string;
  updatedAt: string;
};

/** An employee's vote for where the company's team pool should go. */
export type Vote = { id: string; sponsorId: string; opportunityId: string; voter: string; createdAt: string };
