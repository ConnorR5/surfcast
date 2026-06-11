// GET /api/location/search?q=<query>
// Geocodes the query (Open-Meteo) then resolves the nearest NOAA tide-prediction
// station for up to the first ~6 results (in parallel), so the picker can hand a
// ready-to-use station to /api/forecast. Station resolution degrades per result:
// a failure leaves stationId/stationName undefined rather than failing the call.

import { searchPlaces } from "@/lib/data/openMeteo";
import { nearestTideStation } from "@/lib/data/stations";
import type { PlaceResult } from "@/lib/types";

type ResolvedPlace = PlaceResult & {
  stationId?: string;
  stationName?: string;
};

/** Resolve nearest tide station for the first N results only (keep it snappy). */
const STATION_RESOLVE_LIMIT = 6;

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (!q) return Response.json({ results: [] });

    const places = await searchPlaces(q);

    const results: ResolvedPlace[] = await Promise.all(
      places.map(async (p, i): Promise<ResolvedPlace> => {
        if (i >= STATION_RESOLVE_LIMIT) return { ...p };
        try {
          const station = await nearestTideStation(p.lat, p.lon);
          return station
            ? { ...p, stationId: station.id, stationName: station.name }
            : { ...p };
        } catch {
          return { ...p };
        }
      }),
    );

    return Response.json({ results });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error }, { status: 502 });
  }
}
