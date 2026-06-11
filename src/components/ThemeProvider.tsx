"use client";

// SurfCast theme system. Two palettes live in globals.css:
//   "sunrise"  → light (default)            → <html> WITHOUT the .dark class
//   "deeptide" → dark, .dark on <html>      → <html> WITH the .dark class
// The user picks "auto" | "sunrise" | "deeptide". In "auto" we resolve by the
// local clock (sunrise during daylight hours, deeptide otherwise) and re-check
// every minute so the app flips at dawn/dusk while it's open.
//
// The layout already runs a synchronous pre-paint bootstrap that sets the right
// class + data-theme from localStorage, so there is no flash. This provider just
// keeps React state in sync after hydration and owns subsequent changes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  LS_THEME,
} from "@/lib/config";
import type {
  ResolvedTheme,
  ThemeContextValue,
  ThemePref,
} from "@/lib/types";

const THEME_PREFS: readonly ThemePref[] = ["auto", "sunrise", "deeptide"];

/** <meta name="theme-color"> content per resolved theme (matches globals.css). */
const META_THEME_COLOR: Record<ResolvedTheme, string> = {
  sunrise: "#f6ddbc",
  deeptide: "#182320",
};

function isThemePref(v: string | null): v is ThemePref {
  return v === "auto" || v === "sunrise" || v === "deeptide";
}

/** Resolve an explicit pref, using the local clock for "auto". */
function resolveTheme(pref: ThemePref, now: Date = new Date()): ResolvedTheme {
  if (pref === "sunrise" || pref === "deeptide") return pref;
  const h = now.getHours();
  return h >= DAY_START_HOUR && h < DAY_END_HOUR ? "sunrise" : "deeptide";
}

/** Read the stored pref (SSR-safe). */
function readStoredPref(): ThemePref {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(LS_THEME);
    if (isThemePref(v)) return v;
  } catch {
    /* localStorage may be unavailable (private mode, etc.) */
  }
  return "auto";
}

/** Apply a resolved theme to the document: toggle .dark, set data-theme, and
 *  update the (single, non-media) theme-color meta tag for the browser chrome. */
function applyResolved(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "deeptide");
  root.setAttribute("data-theme", resolved);

  // The layout's `viewport` export emits prefers-color-scheme meta tags. To force
  // a single explicit color we manage our own dedicated, media-less meta tag and
  // keep it last in <head> so it wins. Reuse it across updates.
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", META_THEME_COLOR[resolved]);
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from the pre-paint bootstrap's choice so first render matches the DOM,
  // then reconcile with localStorage in an effect to avoid any hydration mismatch.
  const [theme, setThemeState] = useState<ThemePref>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("sunrise");

  // Hydrate from localStorage + the DOM after mount.
  useEffect(() => {
    const pref = readStoredPref();
    setThemeState(pref);
    const next = resolveTheme(pref);
    setResolved(next);
    applyResolved(next);
  }, []);

  // While in "auto", re-evaluate every 60s so the palette flips at dawn/dusk
  // without a reload. Only mounts the interval when it can actually matter.
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  useEffect(() => {
    if (theme !== "auto") return;
    const tick = () => {
      const next = resolveTheme("auto");
      if (next !== resolvedRef.current) {
        setResolved(next);
        applyResolved(next);
      }
    };
    tick(); // re-check immediately (e.g. just switched back to auto)
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [theme]);

  const setTheme = useCallback((next: ThemePref) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(LS_THEME, next);
    } catch {
      /* ignore persistence failures */
    }
    const r = resolveTheme(next);
    setResolved(r);
    applyResolved(r);
  }, []);

  const cycle = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_PREFS.indexOf(prev);
      const next = THEME_PREFS[(idx + 1) % THEME_PREFS.length] ?? "auto";
      try {
        window.localStorage.setItem(LS_THEME, next);
      } catch {
        /* ignore persistence failures */
      }
      const r = resolveTheme(next);
      setResolved(r);
      applyResolved(r);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, cycle }),
    [theme, resolved, setTheme, cycle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Access the current theme + controls. Must be used under <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
