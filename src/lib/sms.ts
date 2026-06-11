// ───────────────────────────────────────────────────────────────────────────
// Good-surf-day SMS alert pipeline.
//
//   composeAlert(day, location) -> a friendly, scannable text body.
//   sendSurfText(body)          -> sends via Twilio if configured, else no-ops.
//
// This module never throws when Twilio isn't set up — the app must run fine
// without any Twilio credentials. The twilio package is imported lazily so it
// only loads in the code path that actually sends a message.
// ───────────────────────────────────────────────────────────────────────────

import type { DayForecast, Location, MarineHour, SurfHour } from "@/lib/types";
import { DAY_START_HOUR, DAY_END_HOUR } from "@/lib/config";
import {
  clockTime,
  compass,
  longDate,
  parseLocal,
  shortHour,
} from "@/lib/format";

/** A nice capitalized verdict per rating, for the headline line. */
const RATING_HEADLINE: Record<DayForecast["surf"]["rating"], string> = {
  flat: "Flat",
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  epic: "Epic",
};

/** Round to a friendly 1-decimal-or-whole foot value. */
function ftLabel(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? `${r} ft` : `${r.toFixed(1)} ft`;
}

/** Whole-number temperature label, e.g. "68°F". */
function tempLabel(n: number): string {
  return `${Math.round(n)}°F`;
}

/**
 * Find the best run of consecutive daylight hours that score well, and render
 * it as a compact window like "7–10 AM". Returns null if nothing stands out.
 */
function bestWindow(hours: SurfHour[]): { label: string; peakScore: number } | null {
  const daylight = hours
    .filter((h) => h.hour >= DAY_START_HOUR && h.hour <= DAY_END_HOUR)
    .sort((a, b) => a.hour - b.hour);
  if (daylight.length === 0) return null;

  // Threshold relative to the day's best daylight hour, but never below 50.
  const peak = daylight.reduce((m, h) => Math.max(m, h.score), 0);
  const threshold = Math.max(50, peak - 12);

  let best: SurfHour[] = [];
  let run: SurfHour[] = [];
  const flush = () => {
    if (run.length > best.length) best = run;
    run = [];
  };
  for (const h of daylight) {
    if (h.score >= threshold) run.push(h);
    else flush();
  }
  flush();
  if (best.length === 0) return null;

  const start = best[0];
  const end = best[best.length - 1];
  const peakScore = best.reduce((m, h) => Math.max(m, h.score), 0);
  // Render end as the *close* of the last good hour (so 7..9 -> "7–10 AM").
  const startLabel = shortHour(start.time);
  const endIso = endPlusOne(end.time);
  const endLabel = shortHour(endIso);
  const label =
    startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`;
  return { label, peakScore };
}

/** Bump a local-naive ISO timestamp by one hour for window-end labeling. */
function endPlusOne(iso: string): string {
  const d = parseLocal(iso);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Peak wave height + the period at that hour, drawn from the marine hours. */
function peakWave(
  marine: MarineHour[],
): { height: number; period: number } | null {
  let best: MarineHour | null = null;
  for (const m of marine) {
    if (typeof m.waveHeight !== "number") continue;
    if (!best || m.waveHeight > best.waveHeight) best = m;
  }
  if (!best) return null;
  return { height: best.waveHeight, period: best.wavePeriod };
}

/** Representative water temp: the day's stored value, else any marine reading. */
function waterTemp(day: DayForecast): number | undefined {
  if (typeof day.seaSurfaceTemp === "number") return day.seaSurfaceTemp;
  const reading = day.marine.find((m) => typeof m.seaSurfaceTemp === "number");
  return reading?.seaSurfaceTemp;
}

/** Tide times line, e.g. "H 5:11 AM · L 11:32 AM · H 5:48 PM". */
function tideLine(day: DayForecast): string | null {
  if (day.tideExtremes.length === 0) return null;
  return day.tideExtremes
    .map((t) => `${t.type === "H" ? "High" : "Low"} ${clockTime(t.time)}`)
    .join(" · ");
}

/**
 * Compose a short, scannable SMS for a good surf day. A few plain-text lines,
 * no markdown, easy to read at a glance on a phone.
 */
export function composeAlert(day: DayForecast, location: Location): string {
  const headline = RATING_HEADLINE[day.surf.rating] ?? "Surf";
  const score = Math.round(day.surf.score);
  const lines: string[] = [];

  // Headline: location + verdict.
  lines.push(`🌊 ${headline} surf at ${location.name}`);
  lines.push(`${longDate(day.date)} — ${day.surf.label} (${score}/100)`);

  // Waves: peak height, period, and dominant direction.
  const wave = peakWave(day.marine);
  if (wave) {
    const dir = day.marine.find(
      (m) => typeof m.waveDirection === "number",
    )?.waveDirection;
    const dirStr =
      typeof dir === "number" ? ` from ${compass(dir)}` : "";
    lines.push(
      `Waves to ${ftLabel(wave.height)} @ ${Math.round(wave.period)}s${dirStr}`,
    );
  }

  // Best window to paddle out.
  const window = bestWindow(day.surfByHour);
  if (window) {
    lines.push(`Best window: ${window.label}`);
  }

  // Water + UV.
  const water = waterTemp(day);
  const condBits: string[] = [];
  if (typeof water === "number") condBits.push(`Water ${tempLabel(water)}`);
  if (typeof day.uvMax === "number") {
    condBits.push(`UV ${Math.round(day.uvMax)}`);
  }
  if (condBits.length) lines.push(condBits.join(" · "));

  // Tides.
  const tides = tideLine(day);
  if (tides) lines.push(`Tides: ${tides}`);

  return lines.join("\n");
}

/**
 * Low-level send to an explicit recipient via Twilio. Returns { sent:false,
 * reason } instead of throwing when Twilio isn't configured or the send fails,
 * so callers (and the app at large) keep working without any credentials.
 */
export async function sendText(
  to: string,
  body: string,
): Promise<{ sent: boolean; reason?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { sent: false, reason: "twilio-not-configured" };
  }
  if (!to) return { sent: false, reason: "no-recipient" };

  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body, from, to });
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "twilio-send-failed";
    return { sent: false, reason };
  }
}

/**
 * Send the recurring good-surf-day alert to the configured ALERT_TO_NUMBER (the
 * env-based recipient the Vercel cron texts).
 */
export async function sendSurfText(
  body: string,
): Promise<{ sent: boolean; reason?: string }> {
  const to = process.env.ALERT_TO_NUMBER;
  if (!to) return { sent: false, reason: "twilio-not-configured" };
  return sendText(to, body);
}
