// Server-side helpers around the surfcast.* RPCs. Every function degrades
// gracefully (no-op / empty) when Supabase isn't configured.

import { getSupabase } from "./supabase";
import type { Location } from "./types";

export interface SubscriptionRow {
  phone: string;
  enabled: boolean;
  min_score: number;
  location_name: string;
  lat: number;
  lon: number;
  station_id: string;
  timezone: string;
  last_alerted_date: string | null;
}

/** Upsert a subscription by phone. `secret` is the server-held shared secret
 *  that gates writes (CRON_SECRET) — never exposed to the browser. */
export async function upsertSubscription(input: {
  secret: string;
  phone: string;
  enabled: boolean;
  minScore: number;
  location: Location;
}): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "supabase-not-configured" };

  const { error } = await sb.rpc("surfcast_upsert_subscription", {
    p_secret: input.secret,
    p_phone: input.phone,
    p_enabled: input.enabled,
    p_min_score: input.minScore,
    p_location_name: input.location.name,
    p_lat: input.location.lat,
    p_lon: input.location.lon,
    p_station_id: input.location.stationId,
    p_timezone: input.location.timezone,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** All enabled subscriptions (secret-gated RPC). */
export async function listActiveSubscriptions(
  secret: string,
): Promise<SubscriptionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("surfcast_active_subscriptions", {
    p_secret: secret,
  });
  if (error || !data) return [];
  return data as SubscriptionRow[];
}

/** Stamp a subscription as alerted for a date (avoids double-texting). */
export async function markAlerted(
  secret: string,
  phone: string,
  date: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc("surfcast_mark_alerted", {
    p_secret: secret,
    p_phone: phone,
    p_date: date,
  });
}

/** Turn a subscription row into the app's Location shape. */
export function rowToLocation(row: SubscriptionRow): Location {
  return {
    name: row.location_name,
    lat: row.lat,
    lon: row.lon,
    stationId: row.station_id,
    timezone: row.timezone,
  };
}
