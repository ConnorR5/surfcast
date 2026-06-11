// POST /api/alerts/subscribe
// Persists a user's phone + alert preferences to Supabase (surfcast schema, via
// the RLS-locked upsert RPC) and sends a one-time confirmation text so the
// wiring is verifiably real. The recurring evening-before alert is sent by the
// Vercel cron (/api/cron/surf-alert), which reads these subscriptions.

import { sendText } from "@/lib/sms";
import { upsertSubscription } from "@/lib/subscriptions";
import { DEFAULT_LOCATION } from "@/lib/config";
import type { Location } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Normalize a loosely-typed phone string to E.164, or null if implausible. */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      minScore?: number;
      locationName?: string;
      location?: Partial<Location>;
    };

    const phone = normalizePhone(String(body.phone ?? ""));
    if (!phone) {
      return Response.json({ ok: false, error: "invalid-phone" }, { status: 400 });
    }

    const minScore = Number.isFinite(Number(body.minScore))
      ? Number(body.minScore)
      : 62;

    const loc = body.location ?? {};
    const location: Location = {
      name: String(loc.name ?? body.locationName ?? DEFAULT_LOCATION.name),
      lat: Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : DEFAULT_LOCATION.lat,
      lon: Number.isFinite(Number(loc.lon)) ? Number(loc.lon) : DEFAULT_LOCATION.lon,
      stationId: String(loc.stationId ?? DEFAULT_LOCATION.stationId),
      stationName: loc.stationName,
      timezone: String(loc.timezone ?? DEFAULT_LOCATION.timezone),
    };

    const persisted = await upsertSubscription({
      secret: process.env.CRON_SECRET ?? "",
      phone,
      enabled: true,
      minScore,
      location,
    });

    const confirm =
      `🌊 You're set for SurfCast alerts at ${location.name}. ` +
      `We'll text you the evening before it's firing (surf score ${minScore}+). ` +
      `Reply STOP to opt out.`;
    const res = await sendText(phone, confirm);

    return Response.json({
      ok: true,
      phone,
      persisted: persisted.ok,
      persistReason: persisted.reason,
      confirmation: res.sent ? "sent" : "skipped",
      reason: res.reason,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
