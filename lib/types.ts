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
  source: "seed" | "import" | "intake";
  sample?: boolean;
  featured?: boolean; // pinned to the top of the home page and Discover
  createdAt: string;
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
  status: "pledged" | "confirmed";
  createdAt: string;
};
