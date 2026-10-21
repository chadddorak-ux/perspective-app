"use client";

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  max,
}: {
  options: Record<T, string>;
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
}) {
  const toggle = (id: T) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!max || value.length < max) onChange([...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(options) as [T, string][]).map(([id, label]) => {
        const on = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              on ? "border-brand bg-brand text-brand-ink" : "border-line bg-card text-ink hover:border-brand"
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
