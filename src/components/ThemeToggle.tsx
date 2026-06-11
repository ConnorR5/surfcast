"use client";

// A small glass pill that cycles the theme: auto → sunrise → deeptide → auto.
// Shows a sun (sunrise), moon (deeptide), or a sun+moon "auto" glyph. The three
// icons are stacked and cross-fade/scale so the change feels smooth, not snappy.

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/format";
import type { ThemePref } from "@/lib/types";

const NEXT_LABEL: Record<ThemePref, string> = {
  auto: "Sunrise",
  sunrise: "Deep Tide",
  deeptide: "Auto",
};

const CURRENT_LABEL: Record<ThemePref, string> = {
  auto: "Auto theme",
  sunrise: "Sunrise theme",
  deeptide: "Deep Tide theme",
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill="currentColor" />
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <line x1="12" y1="2.4" x2="12" y2="5.2" />
        <line x1="12" y1="18.8" x2="12" y2="21.6" />
        <line x1="2.4" y1="12" x2="5.2" y2="12" />
        <line x1="18.8" y1="12" x2="21.6" y2="12" />
        <line x1="5.05" y1="5.05" x2="7.05" y2="7.05" />
        <line x1="16.95" y1="16.95" x2="18.95" y2="18.95" />
        <line x1="5.05" y1="18.95" x2="7.05" y2="16.95" />
        <line x1="16.95" y1="7.05" x2="18.95" y2="5.05" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Auto: a sun whose disc is bitten by a moon — reads as "follows the clock." */
function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <mask id="sc-auto-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle cx="15.4" cy="9.2" r="4.2" fill="black" />
        </mask>
      </defs>
      <g
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <line x1="12" y1="2.6" x2="12" y2="4.9" />
        <line x1="12" y1="19.1" x2="12" y2="21.4" />
        <line x1="2.6" y1="12" x2="4.9" y2="12" />
        <line x1="19.1" y1="12" x2="21.4" y2="12" />
        <line x1="5.4" y1="5.4" x2="7" y2="7" />
        <line x1="17" y1="17" x2="18.6" y2="18.6" />
        <line x1="5.4" y1="18.6" x2="7" y2="17" />
        <line x1="17" y1="7" x2="18.6" y2="5.4" />
      </g>
      <circle
        cx="12"
        cy="12"
        r="4.6"
        fill="currentColor"
        mask="url(#sc-auto-mask)"
      />
    </svg>
  );
}

/** Stacked icon: only the active one is visible; others fade + scale away. */
function ThemeIcon({ active }: { active: ThemePref }) {
  const layers: Array<{ key: ThemePref; node: React.ReactNode }> = [
    { key: "auto", node: <AutoIcon /> },
    { key: "sunrise", node: <SunIcon /> },
    { key: "deeptide", node: <MoonIcon /> },
  ];
  return (
    <span className="relative block h-[18px] w-[18px]">
      {layers.map(({ key, node }) => {
        const on = key === active;
        return (
          <span
            key={key}
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "[&>svg]:h-full [&>svg]:w-full",
              on
                ? "scale-100 rotate-0 opacity-100"
                : "scale-50 -rotate-90 opacity-0",
            )}
          >
            {node}
          </span>
        );
      })}
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycle } = useTheme();

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${CURRENT_LABEL[theme]}. Switch to ${NEXT_LABEL[theme]}.`}
      title={`${CURRENT_LABEL[theme]} — tap for ${NEXT_LABEL[theme]}`}
      className={cn(
        "glass tide-glow group relative inline-flex h-10 w-10 items-center",
        "justify-center rounded-full text-text",
        "transition-transform duration-300 ease-out",
        "active:scale-90 hover:scale-105",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
        className,
      )}
    >
      {/* Accent tint that warms on sunrise / cools on deeptide via tokens. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full opacity-0",
          "bg-primary/10 transition-opacity duration-300",
          "group-hover:opacity-100",
        )}
      />
      <span className="relative text-accent">
        <ThemeIcon active={theme} />
      </span>
    </button>
  );
}
