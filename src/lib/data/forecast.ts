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

  // Fetch all four sources in parallel; each degrades to empty on failure.
  const [tideExtremes, tideSamples, marine, weather] = await Promise.all([
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

    // Representative ocean temp: the marine hour nearest local noon.
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
    nowLocalISO: nowLocalISO(tz),
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
