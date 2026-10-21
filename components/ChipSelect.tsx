"use client";

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  max,
  groups,
}: {
  options: Record<T, string>;
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
  /** Optional headings that split a long option list into sections. */
  groups?: { label: string; ids: T[] }[];
}) {
  const toggle = (id: T) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!max || value.length < max) onChange([...value, id]);
  };
  if (groups) {
    return (
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-xs font-medium text-muted">{g.label}</p>
            <Chips ids={g.ids} options={options} value={value} toggle={toggle} max={max} />
          </div>
        ))}
        {max && <p className="hint">{value.length}/{max} selected · numbers show priority</p>}
      </div>
    );
  }
  return <Chips ids={Object.keys(options) as T[]} options={options} value={value} toggle={toggle} max={max} />;
}

function Chips<T extends string>({
  ids,
  options,
  value,
  toggle,
  max,
}: {
  ids: T[];
  options: Record<T, string>;
  value: T[];
  toggle: (id: T) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const label = options[id];
        const on = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              on ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink hover:border-ink"
            }`}
          >
            {on && value.length > 1 && max ? `${value.indexOf(id) + 1}. ` : ""}
            {label}
          </button>
        );
      })}
    </div>
  );
}
