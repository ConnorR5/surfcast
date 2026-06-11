"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { DayForecast, SurfRating, WeekStripProps } from "@/lib/types";
import { cn, weekdayShort, dayOfMonth } from "@/lib/format";

// SurfRating has five values but the design system exposes three rating colors.
// Map the extremes onto the nearest available token so the dot always reads true.
function ratingVar(rating: SurfRating): string {
  switch (rating) {
    case "epic":
    case "good":
      return "var(--good)";
    case "fair":
      return "var(--fair)";
    case "poor":
    case "flat":
    default:
      return "var(--poor)";
  }
}

function ratingLabel(rating: SurfRating): string {
  return rating[0].toUpperCase() + rating.slice(1);
}

export default function WeekStrip({
  days,
  selectedDate,
  todayKey,
  onSelectDate,
}: WeekStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Keep the selected pill in view whenever the selection changes. The first
  // alignment (and reduced-motion users) jumps instantly so the strip doesn't
  // visibly fly-in on load; later selection changes glide smoothly.
  const didInitialAlign = useRef(false);
  useLayoutEffect(() => {
    const el = pillRefs.current.get(selectedDate);
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const instant = !didInitialAlign.current || prefersReduced;
    didInitialAlign.current = true;
    el.scrollIntoView({
      behavior: instant ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedDate]);

  // Page the strip by roughly one week's worth of pills.
  const page = useCallback((dir: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Approximate one "week" as 7 pill widths (pill + gap), clamped to viewport.
    const sample = scroller.querySelector<HTMLElement>("[data-pill]");
    const pillWidth = sample ? sample.offsetWidth + 10 : scroller.clientWidth / 4;
    const delta = Math.max(scroller.clientWidth * 0.85, pillWidth * 7) * dir;
    scroller.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  // ArrowLeft / ArrowRight move the selection by one day (chronologically).
  const moveSelection = useCallback(
    (dir: 1 | -1) => {
      const idx = days.findIndex((d) => d.date === selectedDate);
      if (idx === -1) {
        if (days.length) onSelectDate(days[0].date);
        return;
      }
      const next = idx + dir;
      if (next < 0 || next >= days.length) return;
      onSelectDate(days[next].date);
    },
    [days, selectedDate, onSelectDate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fight browser / OS shortcuts (⌘←, ⌥→, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Ignore when the user is typing in a field (e.g. the location search).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSelection]);

  const firstFuture = days.find((d) => d.date > todayKey)?.date;

  return (
    <div className="relative animate-rise">
      {/* Chevron pagers, anchored at the edges and floating over the fade. */}
      <Chevron side="left" onClick={() => page(-1)} />
      <Chevron side="right" onClick={() => page(1)} />

      <div
        ref={scrollerRef}
        className="no-scrollbar edge-fade-x flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-10 px-9 py-1"
        role="tablist"
        aria-label="Select a day"
      >
        {days.map((day, i) => (
          <Pill
            key={day.date}
            day={day}
            index={i}
            selected={day.date === selectedDate}
            isToday={day.date === todayKey}
            startsWeekend={day.date === firstFuture && day.date !== todayKey}
            onSelect={onSelectDate}
            registerRef={(el) => {
              if (el) pillRefs.current.set(day.date, el);
              else pillRefs.current.delete(day.date);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({
  day,
  index,
  selected,
  isToday,
  startsWeekend,
  onSelect,
  registerRef,
}: {
  day: DayForecast;
  index: number;
  selected: boolean;
  isToday: boolean;
  startsWeekend: boolean;
  onSelect: (date: string) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const dotColor = ratingVar(day.surf.rating);
  const label = `${weekdayShort(day.date)} ${dayOfMonth(day.date)}, surf ${ratingLabel(
    day.surf.rating,
  )}${isToday ? ", today" : ""}`;

  return (
    <button
      ref={registerRef}
      data-pill
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      title={day.surf.label}
      onClick={() => onSelect(day.date)}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      className={cn(
        "group relative flex h-[68px] w-[58px] shrink-0 snap-center flex-col items-center justify-center gap-0.5",
        "rounded-2xl border outline-none transition-all duration-300 ease-out animate-rise",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
        "active:scale-[0.94]",
        selected
          ? "border-transparent bg-primary text-white shadow-[var(--shadow)] -translate-y-0.5"
          : "glass border-hairline text-muted hover:text-text hover:-translate-y-0.5",
        day.isPast && !selected && "opacity-65 hover:opacity-100",
      )}
    >
      {/* Today ring — a soft outline that survives the selected state too. */}
      {isToday && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl ring-2",
            selected ? "ring-white/55" : "ring-[var(--accent)]",
          )}
        />
      )}

      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.08em]",
          selected ? "text-white/85" : "text-faint group-hover:text-muted",
        )}
      >
        {isToday ? "Today" : weekdayShort(day.date)}
      </span>

      <span
        className={cn(
          "tabular text-[19px] font-bold leading-none",
          selected ? "text-white" : "text-text",
        )}
      >
        {dayOfMonth(day.date)}
      </span>

      {/* Surf-rating dot. */}
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-[7px] w-[7px] rounded-full transition-transform duration-300",
          selected ? "ring-2 ring-white/40" : "group-hover:scale-125",
        )}
        style={{
          backgroundColor: dotColor,
          boxShadow: selected ? "none" : `0 0 7px ${dotColor}`,
        }}
      />

      {/* Subtle divider hint where the future week begins. */}
      {startsWeekend && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[6px] top-1/2 h-7 w-px -translate-y-1/2 bg-hairline"
        />
      )}
    </button>
  );
}

function Chevron({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const left = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={left ? "Previous days" : "Next days"}
      className={cn(
        "glass-strong absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center",
        "rounded-full text-muted transition-all duration-200",
        "hover:text-text hover:scale-105 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        left ? "left-0" : "right-0",
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={left ? "" : "rotate-180"}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
