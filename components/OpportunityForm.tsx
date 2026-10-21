"use client";

import { AUDIENCES, CAUSES, CAUSE_GROUPS, INDUSTRIES, ORG_TYPES, SENSITIVE_INDUSTRIES, SUPPORT_TYPES, US_STATES } from "@/lib/taxonomy";
import type { OpportunityDraft } from "@/lib/extract";
import type { Tier } from "@/lib/types";
import { ChipSelect } from "./ChipSelect";

export const EMPTY_OPPORTUNITY: OpportunityDraft = {
  orgName: "",
  orgType: "501c3",
  title: "",
  kind: "event",
  summary: "",
  causes: [],
  audiences: [],
  location: {},
  tiers: [],
  asks: ["cash"],
  excludedIndustries: [],
  partners: [],
  contact: {},
};

const SENSITIVE = Object.fromEntries(SENSITIVE_INDUSTRIES.map((id) => [id, INDUSTRIES[id]])) as Record<
  (typeof SENSITIVE_INDUSTRIES)[number],
  string
>;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-line pt-6 first:border-0 first:pt-0">
      <div>
        <legend className="font-display text-xl font-semibold tracking-tight">{title}</legend>
        {hint && <p className="hint mt-0.5">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

export function OpportunityForm({
  value,
  onChange,
}: {
  value: OpportunityDraft;
  onChange: (next: OpportunityDraft) => void;
}) {
  const set = <K extends keyof OpportunityDraft>(k: K, v: OpportunityDraft[K]) => onChange({ ...value, [k]: v });
  const setLoc = (patch: Partial<OpportunityDraft["location"]>) => set("location", { ...value.location, ...patch });
  const setTier = (i: number, patch: Partial<Tier>) =>
    set("tiers", value.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-6">
      <Section title="The basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Organization</span>
            <input className="field" value={value.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder="Riverbend Community Food Bank" />
          </label>
          <label>
            <span className="label">Organization type</span>
            <select className="field" value={value.orgType} onChange={(e) => set("orgType", e.target.value as OpportunityDraft["orgType"])}>
              {Object.entries(ORG_TYPES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Event, program or campaign</span>
            <input className="field" value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Spring Gala 2027" />
          </label>
          <label>
            <span className="label">Kind</span>
            <select className="field" value={value.kind} onChange={(e) => set("kind", e.target.value as OpportunityDraft["kind"])}>
              <option value="event">Event</option>
              <option value="program">Ongoing program</option>
              <option value="campaign">Campaign</option>
              <option value="general">General operating support</option>
            </select>
          </label>
          <label>
            <span className="label">EIN <span className="font-normal text-muted">(optional)</span></span>
            <input className="field" value={value.ein ?? ""} onChange={(e) => set("ein", e.target.value || undefined)} placeholder="12-3456789" />
            <span className="hint">Lets sponsors confirm your 501(c)(3) status.</span>
          </label>
        </div>
        <label className="block">
          <span className="label">Pitch</span>
          <textarea
            className="field min-h-24"
            value={value.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Two or three sentences a sponsor would read first."
          />
        </label>
      </Section>

      <Section title="Who and what it serves" hint="Pick causes in order of importance — the first counts most.">
        <div>
          <span className="label">Causes</span>
          <ChipSelect options={CAUSES} groups={CAUSE_GROUPS} value={value.causes} onChange={(v) => set("causes", v)} max={5} />
        </div>
        <div>
          <span className="label">Audience</span>
          <ChipSelect options={AUDIENCES} value={value.audiences} onChange={(v) => set("audiences", v)} />
        </div>
      </Section>

      <Section title="Where and when">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value.location.virtual} onChange={(e) => setLoc({ virtual: e.target.checked })} />
          Virtual / nationwide
        </label>
        {!value.location.virtual && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">City</span>
              <input className="field" value={value.location.city ?? ""} onChange={(e) => setLoc({ city: e.target.value })} />
            </label>
            <label>
              <span className="label">State</span>
              <select className="field" value={value.location.state ?? ""} onChange={(e) => setLoc({ state: e.target.value || undefined })}>
                <option value="">—</option>
                {Object.entries(US_STATES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Metro area</span>
              <input className="field" value={value.location.metro ?? ""} onChange={(e) => setLoc({ metro: e.target.value })} placeholder="e.g. Chicago" />
            </label>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Starts</span>
            <input type="date" className="field" value={value.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || undefined)} />
          </label>
          <label>
            <span className="label">Ends</span>
            <input type="date" className="field" value={value.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || undefined)} />
          </label>
          <label>
            <span className="label">Expected reach</span>
            <input
              type="number"
              min={0}
              className="field"
              value={value.expectedReach ?? ""}
              onChange={(e) => set("expectedReach", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="attendees"
            />
          </label>
        </div>
      </Section>

      <Section title="Sponsorship levels" hint="Tiers let us match on budget and suggest the right ask for each sponsor.">
        <div className="space-y-3">
          {value.tiers.map((t, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <input className="field" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} placeholder="Gold" aria-label="Tier name" />
                <button type="button" className="btn-ghost shrink-0 px-2" onClick={() => set("tiers", value.tiers.filter((_, j) => j !== i))} aria-label="Remove level">
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={t.amount || ""}
                  onChange={(e) => setTier(i, { amount: Number(e.target.value) })}
                  placeholder="$ amount"
                  aria-label="Amount"
                />
                <select
                  className="field"
                  value={t.availability ?? ""}
                  onChange={(e) => setTier(i, { availability: (e.target.value || undefined) as Tier["availability"] })}
                  aria-label="Availability"
                >
                  <option value="">Availability</option>
                  <option value="exclusive">Exclusive</option>
                  <option value="limited">Limited</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
              <textarea
                className="field mt-2 min-h-16 text-xs"
                value={t.benefits.join("\n")}
                onChange={(e) => setTier(i, { benefits: e.target.value.split("\n") })}
                onBlur={() => setTier(i, { benefits: t.benefits.map((b) => b.trim()).filter(Boolean) })}
                placeholder="Benefits, one per line (logo on shirts, booth, stage remarks…)"
                aria-label="Benefits"
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => set("tiers", [...value.tiers, { name: "", amount: 0, benefits: [] }])}
          >
            + Add level
          </button>
        </div>
      </Section>

      <Section title="What you're asking for">
        <ChipSelect options={SUPPORT_TYPES} value={value.asks} onChange={(v) => set("asks", v)} />
        <div>
          <span className="label">Sponsors you won&apos;t accept</span>
          <p className="hint mb-2">We&apos;ll never suggest sponsors from these industries.</p>
          <ChipSelect options={SENSITIVE} value={value.excludedIndustries as (typeof SENSITIVE_INDUSTRIES)[number][]} onChange={(v) => set("excludedIndustries", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Current partners</span>
            <input
              className="field"
              value={value.partners.join(", ")}
              onChange={(e) => set("partners", e.target.value.split(",").map((s) => s.trimStart()))}
              placeholder="City Parks Dept., Local School District"
            />
            <span className="hint">Social proof — sponsors look for who's already in.</span>
          </label>
          <label>
            <span className="label">Website</span>
            <input className="field" value={value.contact.website ?? ""} onChange={(e) => set("contact", { ...value.contact, website: e.target.value })} />
          </label>
          <label>
            <span className="label">Contact name</span>
            <input className="field" value={value.contact.name ?? ""} onChange={(e) => set("contact", { ...value.contact, name: e.target.value })} />
          </label>
          <label>
            <span className="label">Contact email</span>
            <input type="email" className="field" value={value.contact.email ?? ""} onChange={(e) => set("contact", { ...value.contact, email: e.target.value })} />
          </label>
        </div>
      </Section>
    </div>
  );
}

/** Normalizes form state before it goes over the wire. */
export function cleanOpportunity(d: OpportunityDraft): OpportunityDraft {
  return {
    ...d,
    tiers: d.tiers
      .filter((t) => t.amount > 0)
      .map((t) => ({ ...t, name: t.name.trim() || `$${t.amount.toLocaleString()} level`, benefits: t.benefits.map((b) => b.trim()).filter(Boolean) })),
    partners: d.partners.map((p) => p.trim()).filter(Boolean),
    ein: d.ein?.trim() || undefined,
    location: d.location.virtual ? { virtual: true } : { ...d.location, metro: d.location.metro || d.location.city },
  };
}
