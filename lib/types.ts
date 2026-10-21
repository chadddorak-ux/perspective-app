import type {
  AudienceId,
  CauseId,
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
  benefits: string[];
};

/** Something an organization is raising support for: an event, program or campaign. */
export type Opportunity = {
  id: string;
  orgName: string;
  orgType: OrgTypeId;
  title: string;
  kind: "event" | "program" | "campaign";
  summary: string;
  causes: CauseId[];
  audiences: AudienceId[];
  location: Location;
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string;
  expectedReach?: number; // attendees / participants
  reachNote?: string;
  tiers: Tier[];
  asks: SupportTypeId[];
  partners: string[];
  contact: { name?: string; email?: string; phone?: string; website?: string };
  source: "seed" | "import" | "intake";
  sample?: boolean;
  createdAt: string;
};

/** What a brand, foundation or donor wants to fund. */
export type SponsorProfile = {
  id: string;
  name: string;
  type: SponsorTypeId;
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
