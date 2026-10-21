// Validates anything that arrives over the API before it reaches the matcher or the store.

import { z } from "zod";
import {
  AUDIENCES,
  CAUSES,
  OBJECTIVES,
  ORG_TYPES,
  SPONSOR_TYPES,
  SUPPORT_TYPES,
  US_STATES,
} from "./taxonomy";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));
const usd = z.coerce.number().int().min(0).max(100_000_000);

export const TierInput = z.object({
  name: text(120),
  amount: usd,
  availability: z.enum(["exclusive", "limited", "multiple"]).optional(),
  benefits: z.array(text(200)).max(30).default([]),
});

export const OpportunityInput = z.object({
  orgName: text(160),
  orgType: z.enum(keys(ORG_TYPES)),
  title: text(200),
  kind: z.enum(["event", "program", "campaign"]),
  summary: text(2000).default(""),
  causes: z.array(z.enum(keys(CAUSES))).min(1, "Pick at least one cause").max(6),
  audiences: z.array(z.enum(keys(AUDIENCES))).max(10).default([]),
  location: z.object({
    city: text(80).optional(),
    state: z.enum(keys(US_STATES)).optional().or(z.literal("").transform(() => undefined)),
    metro: text(80).optional(),
    virtual: z.boolean().optional(),
  }),
  startDate: isoDate,
  endDate: isoDate,
  expectedReach: z.coerce.number().int().min(0).max(100_000_000).optional(),
  reachNote: text(300).optional(),
  tiers: z.array(TierInput).max(20).default([]),
  asks: z.array(z.enum(keys(SUPPORT_TYPES))).default([]),
  partners: z.array(text(120)).max(20).default([]),
  contact: z
    .object({
      name: text(160).optional(),
      email: z.email().optional().or(z.literal("").transform(() => undefined)),
      phone: text(40).optional(),
      website: text(300).optional(),
    })
    .default({}),
});
export type OpportunityInput = z.infer<typeof OpportunityInput>;

export const SponsorInput = z
  .object({
    name: text(160),
    type: z.enum(keys(SPONSOR_TYPES)),
    about: text(1000).default(""),
    causes: z.array(z.enum(keys(CAUSES))).min(1, "Pick at least one cause").max(8),
    audiences: z.array(z.enum(keys(AUDIENCES))).max(10).default([]),
    objectives: z.array(z.enum(keys(OBJECTIVES))).max(8).default([]),
    geography: z.object({
      scope: z.enum(["local", "state", "regional", "national"]),
      states: z.array(z.enum(keys(US_STATES))).max(60).default([]),
      metros: z.array(text(80)).max(20).default([]),
    }),
    budget: z.object({ min: usd, max: usd }),
    supportTypes: z.array(z.enum(keys(SUPPORT_TYPES))).min(1).default(["cash"]),
    leadTimeDays: z.coerce.number().int().min(0).max(730).default(60),
    requires501c3: z.boolean().default(false),
    excludedCauses: z.array(z.enum(keys(CAUSES))).default([]),
    approach: z.enum(["open", "intro-preferred", "invite-only"]).default("open"),
  })
  .refine((s) => s.budget.max >= s.budget.min, { message: "Max budget must be at least the minimum", path: ["budget"] });
export type SponsorInput = z.infer<typeof SponsorInput>;

export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input";
}
