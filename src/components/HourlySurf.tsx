"use client";

import { useEffect, useMemo, useRef } from "react";
import type { HourlySurfProps, SurfHour, SurfRating } from "@/lib/types";
import { cn, shortHour, feet, compass, nowLocalISO, dateKey } from "@/lib/format";

// Map the 5-value SurfRating onto the 3 design tokens (good / fair / poor).
// "flat" reads as poor surf; "epic" reads as great surf.
function ratingVar(rating: SurfRating): string {
  switch (rating) {
    case "epic":
    case "good":
      return "var(--good)";
    case "fair":
      return "var(--fair)";
    case "flat":
    case "poor":
    default:
      return "var(--poor)";
  }
}

function ratingTextClass(rating: SurfRating): string {
  switch (rating) {
    case "epic":
    case "good":
      return "text-good";
    case "fair":
      return "text-fair";
    default:
      return "text-poor";
  }
}

export default function HourlySurf({ hours, timezone }: HourlySurfProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);

  // The "current" hour: only meaningful when these hours belong to today.
  const currentHour = useMemo(() => {
    if (hours.length === 0) return null;
    const nowIso = nowLocalISO(timezone);
    const dayKey = dateKey(hours[0].time);
    if (dateKey(nowIso) !== dayKey) return null;
    const h = Number(nowIso.slice(11, 13));
    return h;
  }, [hours, timezone]);

  // Scale bar heights against the day's peak so the chart fills its space.
  const maxWave = useMemo(
    () => Math.max(1, ...hours.map((h) => h.waveHeight)),
    [hours],
  );

  // Center the current hour into view on mount / when it changes. The first
  // center jumps instantly (no fly-in on load); later changes scroll smoothly.
  const didInitialCenter = useRef(false);
  useEffect(() => {
    const scroller = scrollerRef.current;
    const marker = nowRef.current;
    if (!scroller || !marker) return;
    const left =
      marker.offsetLeft - scroller.clientWidth / 2 + marker.clientWidth / 2;
    const instant = !didInitialCenter.current;
    didInitialCenter.current = true;
    scroller.scrollTo({
      left: Math.max(0, left),
      behavior: instant ? "auto" : "smooth",
    });
  }, [currentHour]);

  if (hours.length === 0) {
    return (
      <div className="px-1 py-4 text-center text-sm text-faint">
        No hourly data for this day.
      </div>
    );
  }

  const TRACK = 132; // px — usable bar track height

  return (
    <section className="animate-rise">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Hour by hour
        </h3>
        <span className="text-[11px] text-faint">Wave height &amp; score</span>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar edge-fade-x -mx-1 overflow-x-auto px-1"
      >
        <div className="flex items-end gap-1.5 pb-1">
          {hours.map((h: SurfHour) => {
            const isNow = currentHour !== null && h.hour === currentHour;
            const isPast =
              currentHour !== null && h.hour < currentHour;
            const barH = Math.max(8, (h.waveHeight / maxWave) * TRACK);
            const color = ratingVar(h.rating);

            return (
              <div
                key={h.time}
                ref={isNow ? nowRef : undefined}
                className={cn(
                  "flex w-[52px] shrink-0 flex-col items-center rounded-2xl px-1 py-2 transition-colors",
                  isNow && "bg-surface",
                  isPast && "opacity-55",
                )}
              >
                {/* Score */}
                <div
                  className={cn(
                    "tabular text-[13px] font-bold leading-none",
                    ratingTextClass(h.rating),
                  )}
                >
                  {Math.round(h.score)}
                </div>

                {/* Bar track */}
                <div
                  className="relative my-2 flex w-full items-end justify-center"
                  style={{ height: TRACK }}
                >
                  <div
                    className="w-2.5 rounded-full"
                    style={{
                      height: barH,
                      background: `linear-gradient(to top, ${color}, color-mix(in srgb, ${color} 55%, transparent))`,
                      boxShadow: isNow ? `0 0 12px ${color}` : undefined,
                    }}
                  />
                </div>

                {/* Wave height */}
                <div className="tabular text-[12px] font-semibold leading-none text-text">
                  {h.waveHeight.toFixed(1)}
                  <span className="text-[9px] font-normal text-faint">ft</span>
                </div>

                {/* Period */}
                <div className="tabular mt-1 text-[10px] leading-none text-muted">
                  {Math.round(h.wavePeriod)}s
                </div>

                {/* Wind */}
                <div className="tabular mt-1 flex items-center gap-0.5 text-[10px] leading-none text-faint">
                  <span>{Math.round(h.windSpeed)}</span>
                  <span className="text-[8px]">
                    {compass(h.windDirection)}
                  </span>
                </div>

                {/* Hour label */}
                <div
                  className={cn(
                    "tabular mt-2 text-[11px] leading-none",
                    isNow
                      ? "font-bold text-primary"
                      : "font-medium text-muted",
                  )}
                  title={feet(h.waveHeight)}
                >
                  {isNow ? "Now" : shortHour(h.time)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
