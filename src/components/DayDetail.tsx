"use client";

import { useMemo } from "react";
import type {
  DayDetailProps,
  SurfRating,
  MarineHour,
  WeatherHour,
} from "@/lib/types";
import {
  cn,
  feet,
  temp,
  compass,
  clockTime,
  longDate,
} from "@/lib/format";
import HourlySurf from "./HourlySurf";

// ── Rating → design-token color (good / fair / poor) ─────────────────────────
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
function ratingVar(rating: SurfRating): string {
  switch (rating) {
    case "epic":
    case "good":
      return "var(--good)";
    case "fair":
      return "var(--fair)";
    default:
      return "var(--poor)";
  }
}
function ratingWord(rating: SurfRating): string {
  switch (rating) {
    case "epic":
      return "Epic";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "Flat";
  }
}

// ── UV severity (0–11 scale): green<3, yellow<6, orange<8, red>=8 ────────────
function uvSeverity(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: "Low", color: "var(--good)" };
  if (uv < 6) return { label: "Moderate", color: "var(--fair)" };
  if (uv < 8) return { label: "High", color: "var(--primary)" };
  return { label: "Very high", color: "var(--poor)" };
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col gap-1 rounded-2xl p-3.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function DayDetail({ day, location }: DayDetailProps) {
  const surf = day.surf;
  const ratingColor = ratingVar(surf.rating);

  // Peak wave height, its dominant period, and the time it crests, across the
  // day's marine hours.
  const { peakWave, peakPeriod, peakTime } = useMemo(() => {
    let peakWave = 0;
    let peakPeriod = 0;
    let peakTime = "";
    for (const m of day.marine as MarineHour[]) {
      if (m.waveHeight > peakWave) {
        peakWave = m.waveHeight;
        peakPeriod = m.wavePeriod;
        peakTime = m.time;
      }
    }
    return { peakWave, peakPeriod, peakTime };
  }, [day.marine]);

  // Representative wind: midday (or closest available) atmospheric hour.
  const wind = useMemo(() => {
    const hrs = day.weather as WeatherHour[];
    if (hrs.length === 0) return null;
    let best = hrs[0];
    let bestGap = 24;
    for (const h of hrs) {
      const hour = Number(h.time.slice(11, 13));
      const gap = Math.abs(hour - 12);
      if (gap < bestGap) {
        bestGap = gap;
        best = h;
      }
    }
    return best;
  }, [day.weather]);

  const uv = uvSeverity(day.uvMax);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Headline surf card ──────────────────────────────────────────── */}
      <section
        className="glass-strong animate-rise relative overflow-hidden rounded-3xl p-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${ratingColor} 12%, var(--surface-strong)), var(--surface-strong))`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              {longDate(day.date)}
            </p>
            <h2
              className={cn(
                "mt-0.5 text-[28px] font-semibold italic leading-tight tracking-tight",
                ratingTextClass(surf.rating),
              )}
            >
              {ratingWord(surf.rating)}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">{surf.label}</p>
          </div>

          {/* Big score dial */}
          <div className="relative shrink-0">
            <div
              className="tide-glow flex h-[72px] w-[72px] flex-col items-center justify-center rounded-2xl"
              style={{
                background: `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${ratingColor} 26%, transparent), transparent 72%)`,
                border: `1px solid color-mix(in srgb, ${ratingColor} 45%, transparent)`,
              }}
            >
              <span
                className="font-display tabular text-[32px] font-semibold leading-none"
                style={{ color: ratingColor }}
              >
                {Math.round(surf.score)}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-faint">
                score
              </span>
            </div>
          </div>
        </div>

        {/* Reasons */}
        {surf.reasons.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {surf.reasons.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] leading-snug text-text"
              >
                <span
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: ratingColor }}
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Peak swell footer */}
        <div className="mt-4 flex items-center gap-5 border-t border-hairline pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              Peak wave
            </p>
            <p className="tabular text-lg font-bold text-text">
              {feet(peakWave)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              Period
            </p>
            <p className="tabular text-lg font-bold text-text">
              {Math.round(peakPeriod)}
              <span className="text-sm font-medium text-muted">s</span>
            </p>
          </div>
          {peakTime && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Highest at
              </p>
              <p className="tabular text-lg font-bold text-text">
                {clockTime(peakTime)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Stat tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Water temp */}
        <StatTile label="Water">
          <span className="tabular text-xl font-bold text-text">
            {day.seaSurfaceTemp != null ? temp(day.seaSurfaceTemp) : "—"}
          </span>
          <span className="text-[11px] text-muted">Sea surface</span>
        </StatTile>

        {/* UV */}
        <StatTile label="UV index">
          <div className="flex items-baseline gap-1.5">
            <span
              className="tabular text-xl font-bold"
              style={{ color: uv.color }}
            >
              {Math.round(day.uvMax)}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: uv.color }}>
              {uv.label}
            </span>
          </div>
          {/* 0–11 scale bar */}
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (day.uvMax / 11) * 100)}%`,
                background: uv.color,
              }}
            />
          </div>
        </StatTile>

        {/* Air hi/lo */}
        <StatTile label="Air">
          <div className="flex items-baseline gap-2">
            <span className="tabular text-xl font-bold text-text">
              {temp(day.airTempMax)}
            </span>
            <span className="tabular text-sm font-medium text-faint">
              {temp(day.airTempMin)}
            </span>
          </div>
          <span className="text-[11px] text-muted">High / low</span>
        </StatTile>

        {/* Wind */}
        <StatTile label="Wind">
          {wind ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="tabular text-xl font-bold text-text">
                  {Math.round(wind.windSpeed)}
                </span>
                <span className="text-[11px] font-medium text-muted">mph</span>
              </div>
              <span className="text-[11px] text-muted">
                {compass(wind.windDirection)}
                {wind.windGust != null && wind.windGust > wind.windSpeed
                  ? ` · gusts ${Math.round(wind.windGust)}`
                  : ""}
              </span>
            </>
          ) : (
            <span className="tabular text-xl font-bold text-text">—</span>
          )}
        </StatTile>
      </div>

      {/* ── Tide times ──────────────────────────────────────────────────── */}
      <section className="glass rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Tides
          </h3>
          {location.stationName && (
            <span className="max-w-[55%] truncate text-[11px] text-faint">
              {location.stationName}
            </span>
          )}
        </div>
        {day.tideExtremes.length > 0 ? (
          <div className="flex flex-col gap-1">
            {day.tideExtremes.map((t) => {
              const high = t.type === "H";
              return (
                <div
                  key={t.time}
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      high ? "text-tide" : "text-muted",
                    )}
                    style={{
                      background: high
                        ? "var(--tide-fill)"
                        : "var(--hairline)",
                    }}
                  >
                    {t.type}
                  </span>
                  <span className="w-14 text-[13px] font-medium text-text">
                    {high ? "High" : "Low"}
                  </span>
                  <span className="tabular flex-1 text-[13px] text-muted">
                    {clockTime(t.time)}
                  </span>
                  <span className="tabular text-[13px] font-semibold text-text">
                    {feet(t.height)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-faint">No tide extremes for this day.</p>
        )}
      </section>

      {/* ── Hourly surf breakdown ───────────────────────────────────────── */}
      <section className="glass rounded-3xl p-4">
        <HourlySurf hours={day.surfByHour} timezone={location.timezone} />
      </section>
    </div>
  );
}
