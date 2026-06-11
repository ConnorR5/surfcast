// GET /api/forecast?lat=&lon=&station=&name=&tz=
// Reads the location from query params (falling back to DEFAULT_LOCATION for any
// absent field), builds a Location, and returns the assembled ForecastBundle.
// Upstream caching happens inside the data layer via fetch next:{ revalidate };
// this handler is not cached by default (Next 16), which is what we want.

import { DEFAULT_LOCATION } from "@/lib/config";
import { buildForecast } from "@/lib/data/forecast";
import type { Location } from "@/lib/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    const latRaw = searchParams.get("lat");
    const lonRaw = searchParams.get("lon");
    const lat = latRaw != null ? Number(latRaw) : DEFAULT_LOCATION.lat;
    const lon = lonRaw != null ? Number(lonRaw) : DEFAULT_LOCATION.lon;

    const location: Location = {
      name: searchParams.get("name") ?? DEFAULT_LOCATION.name,
      lat: Number.isFinite(lat) ? lat : DEFAULT_LOCATION.lat,
      lon: Number.isFinite(lon) ? lon : DEFAULT_LOCATION.lon,
      stationId: searchParams.get("station") ?? DEFAULT_LOCATION.stationId,
      stationName: searchParams.get("stationName") ?? DEFAULT_LOCATION.stationName,
      timezone: searchParams.get("tz") ?? DEFAULT_LOCATION.timezone,
    };

    const bundle = await buildForecast(location);
    return Response.json(bundle);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to build forecast";
    return Response.json({ error }, { status: 502 });
  }
}
