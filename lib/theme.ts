"use client";

// Light or dark. With no choice saved the site follows the OS; a choice is
// saved per browser and set on <html data-theme> before the first paint.

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "peep-theme";

/** Runs inline in <head>, before anything paints. */
export const THEME_INIT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  const [theme, set] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => set(currentTheme());
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    window.addEventListener("peep:theme", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("peep:theme", sync);
    };
  }, []);
  return theme;
}
