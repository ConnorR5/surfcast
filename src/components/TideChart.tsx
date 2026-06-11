"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TideChart — the hero of SurfCast. A horizontally scrollable, continuous wavy
// tide line drawn as one wide SVG. The curve flows left (past) → right (future)
// through every TideSample in the range, with per-day dividers, high/low markers,
// a selected-day highlight band, and a pulsing "now" indicator. Tapping a day
// column (or its label) selects it; the selected day auto-centers on change.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useMemo, useRef } from "react";
import type { TideChartProps, TideSample } from "@/lib/types";
import {
  cn,
  dateKey,
  minutesOfDay,
  clockTime,
  weekdayShort,
  monthDay,
} from "@/lib/format";

// ── Geometry constants (SVG user units) ──────────────────────────────────────
// The vertical layout is banded so nothing stacks at the same height:
//   y 0–16   NOW tag        (today only)
//   y 18–46  day header     (weekday + date)
//   y 50–74  high-tide labels band
//   y 80…    the wave curve (peaks never rise above the H-label band)
//   …bottom  low-tide labels band
const DAY_W = 174; // per-day column width
const H = 300; // total SVG height (taller so labels never collide)
const PAD_TOP = 80; // headroom for NOW tag + day header + high-tide labels
const PAD_BOTTOM = 46; // footroom for low-tide labels + their times
const HIGH_LABEL_MIN_TOP = 50; // H labels never climb into the day-header band
const LOW_LABEL_MAX_TOP = H - 30; // L labels never fall off the bottom
const MINUTES_PER_DAY = 1440;

interface DayMeta {
  key: string;
  x0: number; // left edge of the day column
  weekday: string;
  md: string; // "Jun 14"
}

interface PlotPoint {
  x: number;
  y: number;
}

/**
 * Build a smooth cubic-bezier path string through the given points using a
 * Catmull-Rom → bezier conversion. Produces soft, organic wave lines.
 */
function smoothPath(pts: PlotPoint[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    // Catmull-Rom (tension = 0.5 via /6) → cubic control points.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(
      2
    )} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function TideChart({
  curve,
  extremes,
  days,
  selectedDate,
  todayKey,
  nowLocalISO,
  onSelectDate,
}: TideChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const gradId = useId().replace(/:/g, "");

  // Day columns are derived from `days` so column order/width is stable even if
  // the curve has gaps; index → x-offset.
  const dayMeta = useMemo<DayMeta[]>(() => {
    return days.map((day, i) => ({
      key: day.date,
      x0: i * DAY_W,
      weekday: day.weekday || weekdayShort(day.date),
      md: monthDay(day.date),
    }));
  }, [days]);

  const dayIndex = useMemo(() => {
    const m = new Map<string, number>();
    dayMeta.forEach((d, i) => m.set(d.key, i));
    return m;
  }, [dayMeta]);

  const totalW = Math.max(dayMeta.length, 1) * DAY_W;

  // Vertical scale from the min/max tide height across the WHOLE curve, with
  // comfortable padding so peaks/troughs never kiss the chart edges.
  const { yOf, minH, maxH } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of curve) {
      if (s.height < lo) lo = s.height;
      if (s.height > hi) hi = s.height;
    }
    for (const e of extremes) {
      if (e.height < lo) lo = e.height;
      if (e.height > hi) hi = e.height;
    }
    if (!isFinite(lo) || !isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    if (hi - lo < 0.5) {
      // Avoid a flat line when the range is tiny.
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
    const span = hi - lo;
    const usable = H - PAD_TOP - PAD_BOTTOM;
    const yOf = (height: number) =>
      PAD_TOP + (1 - (height - lo) / span) * usable;
    return { yOf, minH: lo, maxH: hi };
  }, [curve, extremes]);

  // Map a sample/extreme time → absolute x across the multi-day chart.
  const xOfTime = useMemo(() => {
    return (iso: string): number | null => {
      const idx = dayIndex.get(dateKey(iso));
      if (idx === undefined) return null;
      const frac = minutesOfDay(iso) / MINUTES_PER_DAY;
      return idx * DAY_W + frac * DAY_W;
    };
  }, [dayIndex]);

  // Build plotted points for the curve in chronological order, skipping any
  // sample whose day isn't part of the visible range.
  const points = useMemo<PlotPoint[]>(() => {
    const pts: PlotPoint[] = [];
    const sorted: TideSample[] = [...curve].sort((a, b) =>
      a.time < b.time ? -1 : a.time > b.time ? 1 : 0
    );
    for (const s of sorted) {
      const x = xOfTime(s.time);
      if (x === null) continue;
      pts.push({ x, y: yOf(s.height) });
    }
    return pts;
  }, [curve, xOfTime, yOf]);

  const linePath = useMemo(() => smoothPath(points), [points]);

  // Closed area path under the line for the gradient fill.
  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const first = points[0];
    const last = points[points.length - 1];
    return (
      smoothPath(points) +
      ` L ${last.x.toFixed(2)} ${H} L ${first.x.toFixed(2)} ${H} Z`
    );
  }, [points]);

  // Extreme markers, with vertical staggering of labels to reduce overlap.
  const markers = useMemo(() => {
    return extremes
      .map((e) => {
        const x = xOfTime(e.time);
        if (x === null) return null;
        const y = yOf(e.height);
        return { ...e, x, y };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.x - b.x);
  }, [extremes, xOfTime, yOf]);

  // "Now" indicator x-position (only when within range).
  const nowX = useMemo(() => xOfTime(nowLocalISO), [xOfTime, nowLocalISO]);

  // ── Auto-center the selected day on mount + whenever it changes ─────────────
  // The very first center jumps instantly (so the chart doesn't visibly fly-in
  // and fight the entrance animation); later selection changes scroll smoothly.
  const didInitialCenter = useRef(false);
  useEffect(() => {
    const container = scrollRef.current;
    const el = dayRefs.current.get(selectedDate);
    if (!container || !el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const target =
      el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
    const left = Math.max(
      0,
      Math.min(target, container.scrollWidth - container.clientWidth)
    );

    const instant = !didInitialCenter.current || prefersReduced;
    didInitialCenter.current = true;

    container.scrollTo({
      left,
      behavior: instant ? "auto" : "smooth",
    });
  }, [selectedDate, dayMeta.length]);

  const selectedIdx = dayIndex.get(selectedDate);
  const yGridTop = yOf(maxH);
  const yGridBottom = yOf(minH);

  return (
    <section
      className="glass animate-rise overflow-hidden rounded-3xl"
      aria-label="Tide chart"
    >
      {/* Header */}
      <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
        <h2 className="text-sm font-semibold tracking-wide text-text">Tides</h2>
        <span className="tabular text-[11px] font-medium text-faint">
          {minH.toFixed(1)}–{maxH.toFixed(1)} ft
        </span>
      </div>

      {/* Scrollable curve */}
      <div
        ref={scrollRef}
        className="no-scrollbar overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="relative" style={{ width: totalW, height: H }}>
          {/* The SVG curve */}
          <svg
            width={totalW}
            height={H}
            viewBox={`0 0 ${totalW} ${H}`}
            preserveAspectRatio="none"
            className="block"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={`tide-fill-${gradId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="var(--tide-fill)" />
                <stop
                  offset="100%"
                  stopColor="var(--tide-fill)"
                  stopOpacity="0"
                />
              </linearGradient>
              <linearGradient
                id={`tide-line-${gradId}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="var(--tide-2)" />
                <stop offset="100%" stopColor="var(--tide)" />
              </linearGradient>
            </defs>

            {/* Selected-day highlight band */}
            {selectedIdx !== undefined && (
              <rect
                x={selectedIdx * DAY_W}
                y={0}
                width={DAY_W}
                height={H}
                fill="var(--tide-fill)"
                opacity={0.55}
                rx={0}
              />
            )}

            {/* Faint vertical day dividers + a subtle horizontal mid grid line */}
            {dayMeta.map((d, i) =>
              i === 0 ? null : (
                <line
                  key={`div-${d.key}`}
                  x1={d.x0}
                  y1={yGridTop - 6}
                  x2={d.x0}
                  y2={yGridBottom + 6}
                  stroke="var(--tide-grid)"
                  strokeWidth={1}
                />
              )
            )}

            {/* Area fill */}
            {areaPath && (
              <path d={areaPath} fill={`url(#tide-fill-${gradId})`} />
            )}

            {/* The wavy tide line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={`url(#tide-line-${gradId})`}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="tide-glow"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Extreme dots */}
            {markers.map((m, i) => (
              <g key={`dot-${m.type}-${m.time}-${i}`}>
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={4.5}
                  fill="var(--bg-base)"
                  stroke="var(--tide)"
                  strokeWidth={2}
                  className="tide-glow"
                />
              </g>
            ))}

            {/* Now indicator line + pulse */}
            {nowX !== null && (
              <g>
                <line
                  x1={nowX}
                  y1={PAD_TOP - 16}
                  x2={nowX}
                  y2={H - PAD_BOTTOM + 10}
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  opacity={0.85}
                />
              </g>
            )}
          </svg>

          {/* ── HTML overlay: labels + interactive day columns ──────────────── */}

          {/* Extreme labels (HTML for crisp, non-stretched text). Stagger H above
              the dot and L below the dot so neighboring labels don't collide. */}
          {markers.map((m, i) => {
            const isHigh = m.type === "H";
            const top = isHigh
              ? Math.max(HIGH_LABEL_MIN_TOP, m.y - 34)
              : Math.min(LOW_LABEL_MAX_TOP, m.y + 12);
            return (
              <div
                key={`lbl-${m.type}-${m.time}-${i}`}
                className="pointer-events-none absolute -translate-x-1/2 text-center"
                style={{ left: m.x, top }}
              >
                <div
                  className={cn(
                    "tabular text-[11px] font-semibold leading-none",
                    isHigh ? "text-tide" : "text-muted"
                  )}
                >
                  {m.type} {m.height.toFixed(1)}
                </div>
                <div className="tabular mt-0.5 whitespace-nowrap text-[9px] leading-none text-faint">
                  {clockTime(m.time)}
                </div>
              </div>
            );
          })}

          {/* Now tag */}
          {nowX !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2"
              style={{ left: nowX, top: 0 }}
            >
              <span
                className="tabular rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-bg"
                style={{
                  background: "var(--primary)",
                  animation: "pulse-now 2.2s ease-in-out infinite",
                }}
              >
                NOW
              </span>
            </div>
          )}

          {/* Interactive day columns + date labels */}
          <div className="absolute inset-0 flex">
            {dayMeta.map((d) => {
              const selected = d.key === selectedDate;
              const isToday = d.key === todayKey;
              return (
                <button
                  key={`col-${d.key}`}
                  ref={(node) => {
                    if (node) dayRefs.current.set(d.key, node);
                    else dayRefs.current.delete(d.key);
                  }}
                  type="button"
                  onClick={() => onSelectDate(d.key)}
                  aria-pressed={selected}
                  aria-label={`${d.weekday} ${d.md}`}
                  className="group flex h-full flex-col items-center justify-start pt-[18px] outline-none"
                  style={{ width: DAY_W }}
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors",
                      selected
                        ? "text-text"
                        : isToday
                          ? "text-primary"
                          : "text-faint group-hover:text-muted"
                    )}
                  >
                    {isToday ? "Today" : d.weekday}
                  </span>
                  <span
                    className={cn(
                      "tabular mt-0.5 text-[9px] leading-none transition-colors",
                      selected ? "text-muted" : "text-faint/70"
                    )}
                  >
                    {d.md}
                  </span>
                  {selected && (
                    <span
                      className="mt-1 h-1 w-1 rounded-full"
                      style={{
                        background: "var(--tide)",
                        boxShadow: "var(--glow)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TideChart;
