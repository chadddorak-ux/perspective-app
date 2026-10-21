import Link from "next/link";

type Option = { value: string; label: string };
export type Filter = { name: string; label: string; options: Option[] };

/** A plain GET form, so filtering works without client JavaScript and URLs are shareable. */
export function FilterBar({
  action,
  filters,
  values,
  query,
  placeholder,
}: {
  action: string;
  filters: Filter[];
  values: Record<string, string | undefined>;
  query?: string;
  placeholder: string;
}) {
  const active = Object.values(values).some(Boolean) || Boolean(query);
  return (
    <form action={action} className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(3,1fr)_auto]">
      <input name="q" defaultValue={query} className="field" placeholder={placeholder} aria-label="Search" />
      {filters.map((f) => (
        <select key={f.name} name={f.name} defaultValue={values[f.name] ?? ""} className="field" aria-label={f.label}>
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      <div className="flex gap-2">
        <button className="btn-primary flex-1">Filter</button>
        {active && <Link href={action} className="btn-ghost">Clear</Link>}
      </div>
    </form>
  );
}

export function toOptions(dict: Record<string, string>, only?: Iterable<string>): Option[] {
  const keep = only ? new Set(only) : null;
  return Object.entries(dict)
    .filter(([k]) => !keep || keep.has(k))
    .map(([value, label]) => ({ value, label }));
}
