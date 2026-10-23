"use client";

// Dark by default, light if you pick it. The choice is saved per browser and
// set on <html data-theme> before the first paint.

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "peep-theme";

/** Runs inline in <head>, before anything paints. */
export const THEME_INIT = `try{document.documentElement.dataset.theme=localStorage.getItem("${KEY}")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent<Theme>("peep:theme", { detail: t }));
}

export function useTheme(): Theme {
  const [theme, set] = useState<Theme>("dark");
  useEffect(() => {
    const sync = () => set(currentTheme());
    sync();
    window.addEventListener("peep:theme", sync);
    return () => window.removeEventListener("peep:theme", sync);
  }, []);
  return theme;
}
