// Open-ocean water temperature from nearby NDBC buoys — the surf-forecasting
// standard. Open-Meteo's modeled sea_surface_temperature runs warm nearshore (it
// samples a coarse ocean grid cell), so for the displayed ocean temp we prefer
// real buoy readings and fall back to Open-Meteo only when no buoy is in range.
//
// Two things make this robust:
//   1. We only consider true offshore BUOYS (type="buoy"); the closest met
//      stations are often coastal C-MAN/NOS fixtures whose realtime2 files 404.
//   2. We take the MEDIAN of the nearest few within a TIGHT radius. The coastal
//      SST gradient is steep — buoys a couple hundred km offshore sit in warm
//      Gulf-Stream/shelf water — so a wide radius or a single nearest buoy is
//      easily skewed. A tight cluster + median tracks the actual coastal water.

const NDBC_ACTIVE_STATIONS = "https://www.ndbc.noaa.gov/activestations.xml";
const NDBC_REALTIME = (id: string) =>
  `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;

const MAX_BUOY_KM = 130; // stay in the near-coastal cluster, not the Gulf Stream
const TRY_NEAREST = 5; // pool the nearest few valid readings for the median

export interface WaterTempReading {
  tempF: number; // median of the nearby coastal buoys
  buoyIds: string[]; // contributing buoys
  count: number;
}

interface Buoy {
  id: string;
  km: number;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest offshore met buoys within MAX_BUOY_KM, closest first. */
async function nearestBuoys(lat: number, lon: number): Promise<Buoy[]> {
  const res = await fetch(NDBC_ACTIVE_STATIONS, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const xml = await res.text();

  const buoys: Buoy[] = [];
  const re = /<station\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    if (!/\btype="buoy"/.test(attrs)) continue; // offshore buoys only
    if (!/\bmet="y"/.test(attrs)) continue; // met buoys report WTMP
    const id = (attrs.match(/\bid="([^"]+)"/) ?? [])[1];
    const blat = Number((attrs.match(/\blat="([^"]+)"/) ?? [])[1]);
    const blon = Number((attrs.match(/\blon="([^"]+)"/) ?? [])[1]);
    if (!id || !Number.isFinite(blat) || !Number.isFinite(blon)) continue;
    const km = haversineKm(lat, lon, blat, blon);
    if (km <= MAX_BUOY_KM) buoys.push({ id, km });
  }

  buoys.sort((a, b) => a.km - b.km);
  return buoys.slice(0, TRY_NEAREST);
}

/** Most recent valid WTMP (°F) from a single buoy's realtime feed, or null. */
async function readBuoyTempF(id: string): Promise<number | null> {
  try {
    const res = await fetch(NDBC_REALTIME(id), { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const txt = await res.text();
    // After the two "#" header lines, rows are newest-first. Columns:
    // YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
    // WTMP (water temp, °C) is field index 14; "MM" means missing.
    const rows = txt.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const row of rows) {
      const f = row.trim().split(/\s+/);
      const raw = f[14];
      if (!raw || raw === "MM") continue;
      const c = Number(raw);
      if (!Number.isFinite(c) || c < -3 || c > 40) continue;
      return c * (9 / 5) + 32;
    }
    return null;
  } catch {
    return null;
  }
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median open-ocean water temp (°F) from the nearest coastal buoys, or null. */
export async function getWaterTempF(
  lat: number,
  lon: number,
): Promise<WaterTempReading | null> {
  let buoys: Buoy[];
  try {
    buoys = await nearestBuoys(lat, lon);
  } catch {
    return null;
  }
  if (buoys.length === 0) return null;

  const readings = await Promise.all(
    buoys.map((b) => readBuoyTempF(b.id).then((f) => (f === null ? null : { id: b.id, f }))),
  );
  const valid = readings.filter((r): r is { id: string; f: number } => r !== null);
  if (valid.length === 0) return null;

  return {
    tempF: median(valid.map((v) => v.f)),
    buoyIds: valid.map((v) => v.id),
    count: valid.length,
  };
}
