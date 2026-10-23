"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/match";
import { bunchPlan, floorCalc } from "@/lib/tax";

/**
 * The 2026 corporate floor in one card: enter taxable income and a giving
 * budget, see what's deductible as gifts, and what bunching years together does.
 */
export function FloorCalculator() {
  const [income, setIncome] = useState(2_000_000);
  const [budget, setBudget] = useState(15_000);
  const [entity, setEntity] = useState<"c-corp" | "pass-through">("c-corp");
  const [years, setYears] = useState(2);
  const r = useMemo(() => floorCalc({ taxableIncome: income, budget, entity }), [income, budget, entity]);
  const plan = useMemo(() => bunchPlan({ taxableIncome: income, budget, entity }, years), [income, budget, entity, years]);
  const share = budget ? Math.min(100, Math.round((r.deductibleGifts / budget) * 100)) : 0;
  const num = (v: string) => Math.max(0, Number(v.replace(/[^0-9.]/g, "")) || 0);

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-card p-6 ring-1 ring-line sm:p-8">
      <div aria-hidden className="absolute inset-0 opacity-50 [background-image:radial-gradient(var(--line)_1.2px,transparent_1.2px)] [background-size:22px_22px]" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
        <div>
          <p className="eyebrow text-brand">New for 2026</p>
          <h2 className="display mt-3 text-3xl font-semibold sm:text-4xl">The 1% floor, in plain numbers</h2>
          <p className="mt-3 text-muted">Corporations can now deduct charitable gifts only above 1% of taxable income. See where your budget lands, and how Peep can paper it.</p>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Taxable income this year</span>
              <input className="field" inputMode="numeric" value={income.toLocaleString("en-US")} onChange={(e) => setIncome(num(e.target.value))} />
            </label>
            <label className="block">
              <span className="label">Giving budget</span>
              <input className="field" inputMode="numeric" value={budget.toLocaleString("en-US")} onChange={(e) => setBudget(num(e.target.value))} />
            </label>
            <div className="flex gap-2 text-sm">
              {(
                [
                  ["c-corp", "C corporation"],
                  ["pass-through", "S corp, LLC or partnership"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setEntity(v)} className={`rounded-full px-3 py-1.5 font-bold ring-1 transition ${entity === v ? "bg-ink text-bg ring-ink" : "ring-line hover:ring-ink/30"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-bg p-5 ring-1 ring-line">
            <p className="font-display text-xl font-semibold leading-snug">{r.headline}</p>
            {entity === "c-corp" && (
              <>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${share}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted">
                  <span>Floor {money(r.floor)}</span>
                  <span>Cap {money(r.cap)}</span>
                </div>
              </>
            )}
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {r.tips.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </div>

          {entity === "c-corp" && (
            <div className="rounded-3xl bg-bg p-5 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Bunch your giving</p>
                <div className="flex gap-1.5 text-sm">
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setYears(n)} className={`rounded-full px-3 py-1 font-bold ring-1 ${years === n ? "bg-ink text-bg ring-ink" : "ring-line"}`}>
                      {n} yr{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                Give {money(plan.bunched)} in one tax year and Peep pays it out quarterly. Deductible: <b className="text-ink">{money(plan.deductibleBunched)}</b> bunched vs{" "}
                <b className="text-ink">{money(plan.deductibleSpread)}</b> spread over {plan.years} year{plan.years > 1 ? "s" : ""}.
              </p>
              <div className="mt-3 flex h-12 items-end gap-1">
                {plan.schedule.map((q) => (
                  <span key={q.quarter} title={`${q.quarter}: ${money(q.amount)}`} className="flex-1 rounded-t bg-sky/70" style={{ height: "100%" }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>{plan.schedule[0]?.quarter}</span>
                <span>{plan.schedule.at(-1)?.quarter}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted">Scheduled payouts across tax years run through a donor-advised fund partner. Coming soon.</p>
            </div>
          )}
          <p className="text-[11px] text-muted">Estimates for planning, not tax advice. Your CPA has the final word.</p>
        </div>
      </div>
    </div>
  );
}
