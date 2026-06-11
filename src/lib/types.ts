// ───────────────────────────────────────────────────────────────────────────
// SurfCast shared types — the single source of truth every module codes against.
// Times from our APIs are LOCAL-NAIVE ISO strings (e.g. "2026-06-11T14:00")
// already in the location's timezone, because we request NOAA + Open-Meteo in
// local time. Treat the first 10 chars as the local date key ("YYYY-MM-DD").
// All distances are imperial: heights in feet, temps in °F, wind in mph.
// ───────────────────────────────────────────────────────────────────────────

/** A place the user can track. `stationId` is a NOAA CO-OPS tide station. */
export interface Location {
  name: string; // e.g. "Stone Harbor, NJ"
  lat: number;
  lon: number;
  stationId: string; // NOAA CO-OPS tide-prediction station id, e.g. "8535581"
  stationName?: string;
  timezone: string; // IANA tz, e.g. "America/New_York"
}

/** One sampled tide height — used to draw the smooth wavy curve. */
export interface TideSample {
  time: string; // local-naive ISO
  height: number; // feet relative to MLLW
}

/** A labeled high/low extreme — used for markers + labels. */
export interface TideExtreme {
  time: string; // local-naive ISO
  height: number; // feet
  type: "H" | "L";
}

/** Hourly ocean/marine conditions from Open-Meteo Marine. */
export interface MarineHour {
  time: string; // local-naive ISO
  waveHeight: number; // ft (significant wave height)
  wavePeriod: number; // s (peak/mean period)
  waveDirection: number; // deg (coming from)
  swellHeight?: number; // ft
  swellPeriod?: number; // s
  windWaveHeight?: number; // ft
  seaSurfaceTemp?: number; // °F (ocean temp)
}

/** Hourly atmospheric conditions from Open-Meteo Forecast. */
export interface WeatherHour {
  time: string; // local-naive ISO
  uvIndex: number;
  airTemp: number; // °F
  windSpeed: number; // mph
  windDirection: number; // deg (coming from)
  windGust?: number; // mph
}

export type SurfRating = "flat" | "poor" | "fair" | "good" | "epic";

/** Surf quality verdict for an hour or a day. */
export interface SurfScore {
  score: number; // 0–100
  rating: SurfRating;
  label: string; // short human verdict, e.g. "Clean & fun"
  factors: {
    wave: number; // 0–100 sub-score
    period: number; // 0–100 sub-score
    wind: number; // 0–100 sub-score
  };
  reasons: string[]; // 1–3 short bullet explanations
}

/** A single hour's surf snapshot for the hourly breakdown chart. */
export interface SurfHour {
  time: string; // local-naive ISO
  hour: number; // 0–23 local hour
  score: number; // 0–100
  rating: SurfRating;
  waveHeight: number; // ft
  wavePeriod: number; // s
  windSpeed: number; // mph
  windDirection: number; // deg
  uvIndex: number;
  airTemp: number; // °F
}

/** Everything we know about one calendar day at a location. */
export interface DayForecast {
  date: string; // "YYYY-MM-DD" (local)
  weekday: string; // "Thu"
  tideExtremes: TideExtreme[];
  tideSamples: TideSample[]; // hourly samples for this day (curve)
  marine: MarineHour[]; // up to 24 hourly
  weather: WeatherHour[]; // up to 24 hourly
  surfByHour: SurfHour[]; // up to 24 hourly
  seaSurfaceTemp?: number; // representative ocean temp (°F), midday
  uvMax: number;
  airTempMax: number; // °F
  airTempMin: number; // °F
  surf: SurfScore; // day-level summary (peak daylight window)
  isPast: boolean;
}

/** The unified payload returned by GET /api/forecast. */
export interface ForecastBundle {
  location: Location;
  generatedAt: string; // ISO instant (UTC)
  todayKey: string; // "YYYY-MM-DD" local today at the location
  nowLocalISO: string; // local-naive ISO "now" at the location
  rangeStart: string; // "YYYY-MM-DD"
  rangeEnd: string; // "YYYY-MM-DD"
  days: DayForecast[];
  /** Continuous tide curve across the whole range, for the scrollable chart. */
  tideCurve: TideSample[];
  tideExtremes: TideExtreme[];
}

/** A geocoding search result (Open-Meteo geocoding + nearest NOAA station). */
export interface PlaceResult {
  name: string; // "Stone Harbor"
  admin1?: string; // "New Jersey"
  country?: string; // "United States"
  countryCode?: string; // "US"
  lat: number;
  lon: number;
  timezone: string;
  label: string; // pretty "Stone Harbor, New Jersey"
}

// ── Component prop contracts (Dashboard ↔ children agree on these) ───────────

export type ThemePref = "auto" | "sunrise" | "deeptide";
export type ResolvedTheme = "sunrise" | "deeptide";

export interface ThemeContextValue {
  theme: ThemePref;
  resolved: ResolvedTheme;
  setTheme: (t: ThemePref) => void;
  cycle: () => void; // auto → sunrise → deeptide → auto
}

export interface WeekStripProps {
  days: DayForecast[]; // all available days, chronological
  selectedDate: string; // "YYYY-MM-DD"
  todayKey: string;
  onSelectDate: (date: string) => void;
}

export interface TideChartProps {
  curve: TideSample[]; // continuous across range
  extremes: TideExtreme[];
  days: DayForecast[];
  selectedDate: string;
  todayKey: string;
  nowLocalISO: string;
  onSelectDate: (date: string) => void;
}

export interface DayDetailProps {
  day: DayForecast;
  location: Location;
}

export interface HourlySurfProps {
  hours: SurfHour[];
  timezone: string;
}
