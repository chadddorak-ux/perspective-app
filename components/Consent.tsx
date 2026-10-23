"use client";

/**
 * Consent first: nothing goes live on Peep until someone from the
 * organization says they're allowed to post it. The page records who and when.
 */
export function Consent({
  org,
  name,
  onName,
  checked,
  onChecked,
  compact = false,
}: {
  org: string;
  name: string;
  onName: (v: string) => void;
  checked: boolean;
  onChecked: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-card ring-1 ring-line ${compact ? "p-3" : "p-4"}`}>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--mint)]" checked={checked} onChange={(e) => onChecked(e.target.checked)} />
        <span>
          I&apos;m authorized to post this for <b>{org || "this organization"}</b>, and I&apos;ve checked the page.
        </span>
      </label>
      <input className="mt-2.5 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-line" placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => onName(e.target.value)} />
    </div>
  );
}

export const consentReady = (checked: boolean, name: string) => checked && name.trim().length >= 2;
