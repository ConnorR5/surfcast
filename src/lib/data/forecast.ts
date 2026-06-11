// buildForecast — the server data layer's orchestrator. Fetches NOAA tide
// (extremes + hourly samples) and Open-Meteo (marine + weather) in parallel,
// buckets every hourly row by its LOCAL date key (first 10 chars of the
// local-naive ISO timestamp), and assembles a per-day + bundle-level
// ForecastBundle. Any single source failing degrades to empty data for that
// source rather than throwing the whole bundle.

import {
  FORECAST_DAYS,
  PAST_DAYS,
  UPSTREAM_REVALIDATE as _UPSTREAM_REVALIDATE,
} from "@/lib/config";
import {
  addDays,
  dateKey,
  nowLocalISO,
  todayKeyAt,
  weekdayShort,
} from "@/lib/format";
import { scoreHour, summarizeDay } from "@/lib/surf";
import type {
  DayForecast,
  ForecastBundle,
  Location,
  MarineHour,
  SurfHour,
  TideExtreme,
  TideSample,
  WeatherHour,
} from "@/lib/types";
import { getTideExtremes, getTideSamples } from "./noaa";
import { getMarine, getWeather } from "./openMeteo";
import { getWaterTempF } from "./waterTemp";

// UPSTREAM_REVALIDATE is applied inside the individual data modules' fetches;
// referenced here only to keep the import contract explicit.
void _UPSTREAM_REVALIDATE;

/** Bucket any list of items keyed by a local-naive ISO `time` field by date. */
function bucketByDate<T extends { time: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = dateKey(it.time);
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  return map;
}

/** Local hour (0–23) from a local-naive ISO timestamp. */
function hourOf(iso: string): number {
  return Number((iso.split("T")[1] ?? "00").slice(0, 2)) || 0;
}

/** Circular mean of a set of bearings (degrees), or undefined if empty/degenerate.
 *  Swells arrive FROM open water, so the mean wave direction is a good proxy for
 *  the direction a beach faces — which is what the wind sub-score needs to judge
 *  offshore vs onshore for ANY coastline, not just Stone Harbor's. */
function circularMeanDeg(degs: number[]): number | undefined {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const d of degs) {
    if (!Number.isFinite(d)) continue;
    const r = (d * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
    n += 1;
  }
  if (n === 0 || (sx === 0 && sy === 0)) return undefined;
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

/** Settle a promise to a fallback value if it rejects (graceful degrade). */
async function settle<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function buildForecast(
  location: Location,
): Promise<ForecastBundle> {
  const tz = location.timezone;
  const todayKey = todayKeyAt(tz);
  const rangeStart = addDays(todayKey, -PAST_DAYS);
  const rangeEnd = addDays(todayKey, FORECAST_DAYS);

  // Open-Meteo: past_days=PAST_DAYS, forecast_days=FORECAST_DAYS+1 (so the final
  // calendar day in our range is fully covered, not truncated at midnight).
  const omForecastDays = FORECAST_DAYS + 1;

  // Fetch all sources in parallel; each degrades to empty/null on failure.
  const [tideExtremes, tideSamples, marine, weather, water] = await Promise.all([
    settle<TideExtreme[]>(
      getTideExtremes(location.stationId, rangeStart, rangeEnd),
      [],
    ),
    settle<TideSample[]>(
      getTideSamples(location.stationId, rangeStart, rangeEnd),
      [],
    ),
    settle<MarineHour[]>(getMarine(location, PAST_DAYS, omForecastDays), []),
    settle<WeatherHour[]>(getWeather(location, PAST_DAYS, omForecastDays), []),
    settle(getWaterTempF(location.lat, location.lon), null),
  ]);

  // Bucket everything by local date key.
  const extremesByDate = bucketByDate(tideExtremes);
  const samplesByDate = bucketByDate(tideSamples);
  const marineByDate = bucketByDate(marine);
  const weatherByDate = bucketByDate(weather);

  // Build the ordered list of day keys spanning [rangeStart, rangeEnd].
  const dayKeys: string[] = [];
  for (let k = rangeStart; ; k = addDays(k, 1)) {
    dayKeys.push(k);
    if (k === rangeEnd) break;
  }

  // ── Water-temp anchoring ───────────────────────────────────────────────────
  // Open-Meteo's modeled SST runs warm nearshore, so when a real open-ocean NDBC
  // buoy reading is available we shift the per-day model SST by a single offset
  // (buoy − model, at "now"). That keeps any day-to-day trend but pins the level
  // to reality. With no model SST to anchor against, we use the buoy value flat.
  const nowIso = nowLocalISO(tz);
  const nowHour = hourOf(nowIso);
  let modelNowSst: number | undefined;
  let nearestToNow = Infinity;
  for (const m of marine) {
    if (m.seaSurfaceTemp === undefined || dateKey(m.time) !== todayKey) continue;
    const d = Math.abs(hourOf(m.time) - nowHour);
    if (d < nearestToNow) {
      nearestToNow = d;
      modelNowSst = m.seaSurfaceTemp;
    }
  }
  const waterOffset =
    water && typeof modelNowSst === "number"
      ? Math.max(-15, Math.min(15, water.tempF - modelNowSst))
      : 0;

  // Estimate which way this beach faces from its dominant swell direction, so the
  // surf score's offshore/onshore wind judgment is correct anywhere (falls back
  // to the Stone Harbor default inside scoreHour when there's no wave-direction).
  const coastFacing = circularMeanDeg(marine.map((m) => m.waveDirection));

  const days: DayForecast[] = dayKeys.map((date) => {
    const dExtremes = (extremesByDate.get(date) ?? []).sort((a, b) =>
      a.time < b.time ? -1 : 1,
    );
    const dSamples = (samplesByDate.get(date) ?? []).sort((a, b) =>
      a.time < b.time ? -1 : 1,
    );
    const dMarine = (marineByDate.get(date) ?? []).sort((a, b) =>
      a.time < b.time ? -1 : 1,
    );
    const dWeather = (weatherByDate.get(date) ?? []).sort((a, b) =>
      a.time < b.time ? -1 : 1,
    );

    // Index weather by hour so we can pair it with the marine hour.
    const weatherByHour = new Map<number, WeatherHour>();
    for (const w of dWeather) weatherByHour.set(hourOf(w.time), w);

    // Compute the per-hour surf snapshots from marine wave + weather wind.
    const surfByHour: SurfHour[] = dMarine.map((m) => {
      const hr = hourOf(m.time);
      const w = weatherByHour.get(hr);
      const windSpeed = w?.windSpeed ?? 0;
      const windDirection = w?.windDirection ?? 0;
      const sc = scoreHour({
        waveHeight: m.waveHeight,
        wavePeriod: m.wavePeriod,
        windSpeed,
        windDirection,
        coastFacingDeg: coastFacing,
      });
      return {
        time: m.time,
        hour: hr,
        score: sc.score,
        rating: sc.rating,
        waveHeight: m.waveHeight,
        wavePeriod: m.wavePeriod,
        windSpeed,
        windDirection,
        uvIndex: w?.uvIndex ?? 0,
        airTemp: w?.airTemp ?? 0,
      };
    });

    const surf = summarizeDay(surfByHour);

    // Representative ocean temp: the marine hour nearest local noon, then
    // anchored to the open-ocean buoy reading (see waterOffset above).
    let seaSurfaceTemp: number | undefined;
    let bestNoonDist = Infinity;
    for (const m of dMarine) {
      if (m.seaSurfaceTemp === undefined) continue;
      const dist = Math.abs(hourOf(m.time) - 12);
      if (dist < bestNoonDist) {
        bestNoonDist = dist;
        seaSurfaceTemp = m.seaSurfaceTemp;
      }
    }
    if (water) {
      seaSurfaceTemp =
        seaSurfaceTemp !== undefined ? seaSurfaceTemp + waterOffset : water.tempF;
    }

    const uvMax = dWeather.reduce((mx, w) => Math.max(mx, w.uvIndex), 0);
    const temps = dWeather.map((w) => w.airTemp).filter(Number.isFinite);
    const airTempMax = temps.length ? Math.max(...temps) : 0;
    const airTempMin = temps.length ? Math.min(...temps) : 0;

    return {
      date,
      weekday: weekdayShort(date),
      tideExtremes: dExtremes,
      tideSamples: dSamples,
      marine: dMarine,
      weather: dWeather,
      surfByHour,
      seaSurfaceTemp,
      uvMax,
      airTempMax,
      airTempMin,
      surf,
      isPast: date < todayKey,
    };
  });

  return {
    location,
    generatedAt: new Date().toISOString(),
    todayKey,
    nowLocalISO: nowIso,
    rangeStart,
    rangeEnd,
    days,
    tideCurve: tideSamples
      .slice()
      .sort((a, b) => (a.time < b.time ? -1 : 1)),
    tideExtremes: tideExtremes
      .slice()
      .sort((a, b) => (a.time < b.time ? -1 : 1)),
  };
}
