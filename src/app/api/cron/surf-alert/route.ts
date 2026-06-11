// ───────────────────────────────────────────────────────────────────────────
// GET /api/cron/surf-alert — Vercel Cron target (also manually testable).
//
// For every enabled subscription (Supabase), checks TOMORROW's surf at that
// subscriber's beach and texts them when it scores at/above their threshold —
// once per day per subscriber. When Supabase isn't configured, falls back to a
// single env-configured recipient (ALERT_TO_NUMBER at ALERT_* location).
//
// Auth: when CRON_SECRET is set, require either
//   Authorization: Bearer <CRON_SECRET>   (Vercel Cron sends this), or
//   ?key=<CRON_SECRET>                     (handy for manual testing).
//
// Never throws to the client: failures are caught and returned as JSON.
// ───────────────────────────────────────────────────────────────────────────

import { buildForecast } from "@/lib/data/forecast";
import { composeAlert, sendSurfText, sendText } from "@/lib/sms";
import { DEFAULT_LOCATION } from "@/lib/config";
import { addDays } from "@/lib/format";
import type { ForecastBundle, Location } from "@/lib/types";
import {
  listActiveSubscriptions,
  markAlerted,
  rowToLocation,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** True when CRON_SECRET is unset, or the request presents the right secret. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open in environments without a secret
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("key") === secret;
}

/** Env-based single-recipient fallback location (when Supabase is absent). */
function envLocation(): Location {
  const lat = Number(process.env.ALERT_LAT);
  const lon = Number(process.env.ALERT_LON);
  const stationId = process.env.ALERT_STATION_ID;
  const name = process.env.ALERT_LOCATION_NAME;
  const timezone = process.env.ALERT_TIMEZONE;
  if (name && stationId && timezone && Number.isFinite(lat) && Number.isFinite(lon)) {
    return { name, lat, lon, stationId, timezone };
  }
  return DEFAULT_LOCATION;
}

const locKey = (l: Location) => `${l.lat},${l.lon},${l.stationId}`;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET ?? "";

  try {
    const subs = await listActiveSubscriptions(secret);

    // ── Supabase path: one notification per enabled subscriber ──────────────
    if (subs.length > 0) {
      // Build each distinct beach's forecast once, then fan out to subscribers.
      const bundles = new Map<string, ForecastBundle>();
      const results: Array<Record<string, unknown>> = [];

      for (const sub of subs) {
        const location = rowToLocation(sub);
        const key = locKey(location);

        let bundle = bundles.get(key);
        if (!bundle) {
          bundle = await buildForecast(location);
          bundles.set(key, bundle);
        }

        const targetDate = addDays(bundle.todayKey, 1);
        const day = bundle.days.find((d) => d.date === targetDate);

        if (!day) {
          results.push({ phone: mask(sub.phone), checked: targetDate, sent: false, reason: "no-forecast" });
          continue;
        }
        if (sub.last_alerted_date === targetDate) {
          results.push({ phone: mask(sub.phone), checked: targetDate, sent: false, reason: "already-alerted" });
          continue;
        }
        if (day.surf.score < sub.min_score) {
          results.push({ phone: mask(sub.phone), checked: targetDate, score: day.surf.score, sent: false, reason: "below-threshold" });
          continue;
        }

        const body = composeAlert(day, location);
        const res = await sendText(sub.phone, body);
        if (res.sent) await markAlerted(secret, sub.phone, targetDate);
        results.push({
          phone: mask(sub.phone),
          checked: targetDate,
          score: day.surf.score,
          rating: day.surf.rating,
          sent: res.sent,
          reason: res.reason,
        });
      }

      const sent = results.filter((r) => r.sent).length;
      return Response.json({ mode: "subscriptions", subscribers: subs.length, sent, results });
    }

    // ── Fallback path: single env recipient ─────────────────────────────────
    const location = envLocation();
    const bundle = await buildForecast(location);
    const targetDate = addDays(bundle.todayKey, 1);
    const day = bundle.days.find((d) => d.date === targetDate);

    if (!day) {
      return Response.json({ mode: "env", checked: targetDate, sent: false, reason: "no-forecast-for-day" });
    }

    const minScore = Number(process.env.ALERT_MIN_SCORE) || 62;
    if (day.surf.score < minScore) {
      return Response.json({ mode: "env", checked: targetDate, score: day.surf.score, rating: day.surf.rating, sent: false, reason: "below-threshold" });
    }

    const result = await sendSurfText(composeAlert(day, location));
    return Response.json({ mode: "env", checked: targetDate, score: day.surf.score, rating: day.surf.rating, sent: result.sent, reason: result.reason });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown-error";
    return Response.json({ sent: false, reason }, { status: 200 });
  }
}

/** Mask a phone for response logging (keep last 4). */
function mask(phone: string): string {
  return phone.length >= 4 ? `…${phone.slice(-4)}` : "…";
}
