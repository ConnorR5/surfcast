// Open-Meteo data sources (all free, no API key):
//   • Marine  -> hourly wave/swell + sea-surface temperature
//   • Forecast -> hourly UV / air temp / wind
//   • Geocoding -> place search
// We request timezone=<IANA> so all hourly.time[] come back as local-naive ISO
// strings, and length_unit=imperial so wave heights are already in feet.
// IMPORTANT: sea_surface_temperature is returned in CELSIUS — we convert to °F.

import { OPEN_METEO, UPSTREAM_REVALIDATE } from "@/lib/config";
import type { Location, MarineHour, PlaceResult, WeatherHour } from "@/lib/types";

/** Celsius -> Fahrenheit. */
function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

/** Safe element read: returns undefined for null/NaN so optional fields degrade. */
function num(arr: (number | null)[] | undefined, i: number): number | undefined {
  const v = arr?.[i];
  return v == null || Number.isNaN(v) ? undefined : v;
}

interface MarineResponse {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
    wave_period?: (number | null)[];
    wave_direction?: (number | null)[];
    sea_surface_temperature?: (number | null)[];
    swell_wave_height?: (number | null)[];
    swell_wave_period?: (number | null)[];
    wind_wave_height?: (number | null)[];
  };
}

interface ForecastResponse {
  hourly?: {
    time?: string[];
    uv_index?: (number | null)[];
    temperature_2m?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
  };
}

interface GeocodeResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    country_code?: string;
    admin1?: string;
    timezone: string;
  }>;
}

/** Hourly marine conditions for a location. SST converted C->F. */
export async function getMarine(
  loc: Location,
  past: number,
  forecast: number,
): Promise<MarineHour[]> {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    hourly: [
      "wave_height",
      "wave_period",
      "wave_direction",
      "sea_surface_temperature",
      "swell_wave_height",
      "swell_wave_period",
      "wind_wave_height",
    ].join(","),
    daily: ["wave_height_max", "wave_period_max", "wave_direction_dominant"].join(","),
    timezone: loc.timezone,
    length_unit: "imperial",
    past_days: String(past),
    forecast_days: String(forecast),
  });
  const res = await fetch(`${OPEN_METEO.marine}?${params.toString()}`, {
    next: { revalidate: UPSTREAM_REVALIDATE },
  });
  if (!res.ok) throw new Error(`Open-Meteo marine failed: ${res.status}`);
  const data = (await res.json()) as MarineResponse;
  const h = data.hourly;
  const times = h?.time ?? [];
  return times.map((time, i) => {
    const sst = num(h?.sea_surface_temperature, i);
    return {
      time,
      waveHeight: num(h?.wave_height, i) ?? 0,
      wavePeriod: num(h?.wave_period, i) ?? 0,
      waveDirection: num(h?.wave_direction, i) ?? 0,
      swellHeight: num(h?.swell_wave_height, i),
      swellPeriod: num(h?.swell_wave_period, i),
      windWaveHeight: num(h?.wind_wave_height, i),
      seaSurfaceTemp: sst === undefined ? undefined : cToF(sst),
    };
  });
}

/** Hourly atmospheric conditions for a location. */
export async function getWeather(
  loc: Location,
  past: number,
  forecast: number,
): Promise<WeatherHour[]> {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    hourly: [
      "uv_index",
      "temperature_2m",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    daily: ["uv_index_max", "temperature_2m_max", "temperature_2m_min"].join(","),
    timezone: loc.timezone,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    past_days: String(past),
    forecast_days: String(forecast),
  });
  const res = await fetch(`${OPEN_METEO.forecast}?${params.toString()}`, {
    next: { revalidate: UPSTREAM_REVALIDATE },
  });
  if (!res.ok) throw new Error(`Open-Meteo forecast failed: ${res.status}`);
  const data = (await res.json()) as ForecastResponse;
  const h = data.hourly;
  const times = h?.time ?? [];
  return times.map((time, i) => ({
    time,
    uvIndex: num(h?.uv_index, i) ?? 0,
    airTemp: num(h?.temperature_2m, i) ?? 0,
    windSpeed: num(h?.wind_speed_10m, i) ?? 0,
    windDirection: num(h?.wind_direction_10m, i) ?? 0,
    windGust: num(h?.wind_gusts_10m, i),
  }));
}

/** Geocode a place query into ranked PlaceResult[]. Returns [] on no match. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    name: q,
    count: "8",
    language: "en",
    format: "json",
  });
  const res = await fetch(`${OPEN_METEO.geocode}?${params.toString()}`, {
    next: { revalidate: UPSTREAM_REVALIDATE },
  });
  if (!res.ok) throw new Error(`Open-Meteo geocoding failed: ${res.status}`);
  const data = (await res.json()) as GeocodeResponse;
  return (data.results ?? []).map((r) => {
    const label = [r.name, r.admin1].filter(Boolean).join(", ") || r.name;
    return {
      name: r.name,
      admin1: r.admin1,
      country: r.country,
      countryCode: r.country_code,
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone,
      label,
    };
  });
}
