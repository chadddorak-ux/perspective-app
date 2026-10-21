import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AUDIENCES, CAUSES, ORG_TYPES, SUPPORT_TYPES, US_STATES } from "./taxonomy";
import type { ExtractResult } from "./extract";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const OpportunitySchema = z.object({
  orgName: z.string(),
  orgType: z.enum(keys(ORG_TYPES)),
  title: z.string().describe("Event, program or campaign name"),
  kind: z.enum(["event", "program", "campaign"]),
  summary: z.string().describe("2–3 sentence pitch a sponsor would read first"),
  causes: z.array(z.enum(keys(CAUSES))).describe("Most relevant first, max 5"),
  audiences: z.array(z.enum(keys(AUDIENCES))),
  city: z.string().nullable(),
  state: z.enum(keys(US_STATES)).nullable(),
  metro: z.string().nullable().describe("Nearest major metro, e.g. Miami for Homestead, FL"),
  virtual: z.boolean(),
  startDate: z.string().nullable().describe("YYYY-MM-DD"),
  endDate: z.string().nullable().describe("YYYY-MM-DD"),
  expectedReach: z.number().nullable().describe("Total expected attendees or participants"),
  reachNote: z.string().nullable(),
  tiers: z.array(
    z.object({
      name: z.string(),
      amount: z.number().describe("USD"),
      availability: z.enum(["exclusive", "limited", "multiple"]).nullable(),
      benefits: z.array(z.string()),
    }),
  ),
  asks: z.array(z.enum(keys(SUPPORT_TYPES))),
  partners: z.array(z.string()),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  website: z.string().nullable(),
  warnings: z.array(z.string()).describe("Anything missing or ambiguous a human should confirm"),
});

const SYSTEM = `You turn sponsorship pitches (emails, one-pagers, sponsorship packages) into a structured listing for a sponsor-matching platform.

Extract only what the material supports. Map causes and audiences to the closest allowed ids. For sponsorship tiers, keep the organizer's tier names, the dollar amount, availability (exclusive/limited/multiple when stated), and the concrete benefits for that tier. When a PDF lays tiers out as a grid, read each column carefully so benefits land on the right tier. "asks" covers every way the organizer asks for help (cash sponsorship, volunteers, mentors, introductions, in-kind, media). Use warnings for anything a human should confirm, such as an unclear year or a benefit grid you couldn't read with confidence.`;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function extractWithAI(text: string, pdfBase64?: string): Promise<ExtractResult> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
  }
  content.push({
    type: "text",
    text: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n<pitch>\n${text || "(see attached document)"}\n</pitch>`,
  });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(OpportunitySchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to process this document");
  const out = response.parsed_output;
  if (!out) throw new Error(`Couldn't parse the model's response (stop reason: ${response.stop_reason})`);

  return {
    method: "ai",
    warnings: out.warnings,
    draft: {
      orgName: out.orgName,
      orgType: out.orgType,
      title: out.title,
      kind: out.kind,
      summary: out.summary,
      causes: out.causes.slice(0, 5),
      audiences: out.audiences,
      location: out.virtual
        ? { virtual: true }
        : { city: out.city ?? undefined, state: out.state ?? undefined, metro: out.metro ?? out.city ?? undefined },
      startDate: out.startDate ?? undefined,
      endDate: out.endDate ?? undefined,
      expectedReach: out.expectedReach ?? undefined,
      reachNote: out.reachNote ?? undefined,
      tiers: out.tiers
        .map((t) => ({ ...t, availability: t.availability ?? undefined }))
        .sort((a, b) => b.amount - a.amount),
      asks: out.asks,
      partners: out.partners,
      contact: {
        name: out.contactName ?? undefined,
        email: out.contactEmail ?? undefined,
        phone: out.contactPhone ?? undefined,
        website: out.website ?? undefined,
      },
    },
  };
}
