// Find the nearest NOAA CO-OPS tide-prediction station to an arbitrary lat/lon.
// The full station list is large but extremely stable, so we cache it for a day.
// Nearest is chosen by great-circle (haversine) distance.

import { NOAA_MDAPI } from "@/lib/config";

interface MdapiStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state?: string;
}
interface MdapiResponse {
  stations?: MdapiStation[];
}

const STATIONS_REVALIDATE = 86400; // 24h — station metadata rarely changes.

/** Great-circle distance (km) between two lat/lon points. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Nearest tide-prediction station to a point. Returns null if none resolvable. */
export async function nearestTideStation(
  lat: number,
  lon: number,
): Promise<{ id: string; name: string } | null> {
  const params = new URLSearchParams({ type: "tidepredictions" });
  const res = await fetch(`${NOAA_MDAPI}?${params.toString()}`, {
    next: { revalidate: STATIONS_REVALIDATE },
  });
  if (!res.ok) throw new Error(`NOAA mdapi failed: ${res.status}`);
  const data = (await res.json()) as MdapiResponse;
  const stations = data.stations ?? [];

  let best: { id: string; name: string } | null = null;
  let bestDist = Infinity;
  for (const s of stations) {
    if (
      typeof s.lat !== "number" ||
      typeof s.lng !== "number" ||
      Number.isNaN(s.lat) ||
      Number.isNaN(s.lng)
    ) {
      continue;
    }
    const d = haversineKm(lat, lon, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = { id: String(s.id), name: s.name };
    }
  }
  return best;
}
