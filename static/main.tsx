// Entry point for the static build: the same pages and components as the
// Next app, rendered in the browser with an in-memory router.

import "./api";
import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import * as Campaign from "../app/opportunities/[id]/page";
import * as Discover from "../app/opportunities/page";
import * as Find from "../app/find/page";
import * as Give from "../app/give/page";
import * as Home from "../app/page";
import * as Import from "../app/import/page";
import * as Intros from "../app/intros/page";
import * as Sponsor from "../app/sponsors/[id]/page";
import * as Sponsors from "../app/sponsors/page";
import { SiteChrome } from "../components/SiteChrome";
import { navigate, pathForToken, useRoute } from "./router";
import { NotFoundError } from "./shims/navigation";

type PageModule = { default: (props: never) => ReactNode | Promise<ReactNode>; metadata?: { title?: string } };

const ROUTES: [RegExp, PageModule][] = [
  [/^\/$/, Home as PageModule],
  [/^\/opportunities$/, Discover as PageModule],
  [/^\/opportunities\/(?<id>[^/]+)$/, Campaign as PageModule],
  [/^\/sponsors$/, Sponsors as PageModule],
  [/^\/sponsors\/(?<id>[^/]+)$/, Sponsor as PageModule],
  [/^\/find$/, Find as PageModule],
  [/^\/give$/, Give as PageModule],
  [/^\/import$/, Import as PageModule],
  [/^\/intros$/, Intros as PageModule],
];

function NotFound() {
  return (
    <div className="py-20">
      <p className="eyebrow text-muted">404</p>
      <h1 className="display mt-4 text-5xl font-semibold">We couldn&apos;t find that page.</h1>
      <button className="btn-primary mt-8" onClick={() => navigate("/")}>
        Back to home
      </button>
    </div>
  );
}

function App() {
  const route = useRoute();
  const [view, setView] = useState<{ key: string; el: ReactNode } | null>(null);
  const pageKey = `${route.path}?${new URLSearchParams(route.query)}`;

  // Render the matching page. Server pages are async functions that load data
  // and return JSX, so they can be awaited here directly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = ROUTES.map(([re, mod]) => ({ m: route.path.match(re), mod })).find((r) => r.m);
      let el: ReactNode;
      try {
        if (!found) throw new NotFoundError();
        const props = { params: Promise.resolve(found.m!.groups ?? {}), searchParams: Promise.resolve(route.query) };
        el = await found.mod.default(props as never);
        const title = found.mod.metadata?.title;
        document.title = title ? title.replace(" — Perspective", "") + " · Perspective" : "Perspective";
      } catch (e) {
        if (!(e instanceof NotFoundError)) console.error(e);
        el = <NotFound />;
        document.title = "Not found · Perspective";
      }
      if (!cancelled) setView({ key: pageKey, el });
    })();
    return () => {
      cancelled = true;
    };
  }, [route.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // New page: jump to its anchor, or to the top. Refreshes keep the scroll position.
  const [lastKey, setLastKey] = useState("");
  useEffect(() => {
    if (!view || view.key === lastKey) return;
    setLastKey(view.key);
    requestAnimationFrame(() => {
      const target = route.anchor ? document.getElementById(route.anchor) : null;
      if (target) target.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo(0, 0);
    });
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plain links and GET forms inside pages (in-page anchors, FilterBar) are routed here.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      const href = a?.getAttribute("href");
      if (!a || !href || a.target === "_blank") return;
      if (href.startsWith("/")) {
        e.preventDefault();
        navigate(href);
      } else if (href.startsWith("#")) {
        const id = href.slice(1);
        const el = id && document.getElementById(id);
        e.preventDefault();
        if (el) el.scrollIntoView({ behavior: "smooth" });
        else if (pathForToken(id) !== null) navigate(pathForToken(id)!);
      }
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const action = form.getAttribute("action");
      if (!action?.startsWith("/") || (form.method || "get").toLowerCase() !== "get") return;
      e.preventDefault();
      const qs = new URLSearchParams();
      new FormData(form).forEach((v, k) => typeof v === "string" && v && qs.append(k, v));
      navigate(`${action}${qs.size ? `?${qs}` : ""}`);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  return (
    <SiteChrome>
      {view ? <div key={view.key}>{view.el}</div> : <div className="min-h-[60vh]" aria-busy="true" />}
    </SiteChrome>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
