// Stand-in for next/link in the static build.
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { hrefFor, navigate } from "../router";

type Href = string | { pathname: string; query?: Record<string, string | undefined> };

function toUrl(href: Href): string {
  if (typeof href === "string") return href;
  const qs = new URLSearchParams(Object.entries(href.query ?? {}).filter(([, v]) => v != null) as [string, string][]).toString();
  return href.pathname + (qs ? `?${qs}` : "");
}

export default function Link({
  href,
  children,
  onClick,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: Href; children?: ReactNode; prefetch?: boolean }) {
  const url = toUrl(href);
  delete (rest as { prefetch?: boolean }).prefetch;
  return (
    <a
      {...rest}
      href={hrefFor(url)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(url);
      }}
    >
      {children}
    </a>
  );
}
