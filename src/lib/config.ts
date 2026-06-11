import type { Location } from "./types";

/** Default location when the user hasn't picked one yet. */
export const DEFAULT_LOCATION: Location = {
  name: "Stone Harbor, NJ",
  lat: 39.0537,
  lon: -74.7574,
  stationId: "8535581", // NOAA CO-OPS — "Stone Harbor, Great Channel, NJ"
  stationName: "Stone Harbor, Great Channel",
  timezone: "America/New_York",
};

/** How many days of history / future the dashboard shows. */
export const PAST_DAYS = 7;
/** Open-Meteo marine wave models stay reliable ~7 days out. */
export const FORECAST_DAYS = 7;

/** localStorage keys. */
export const LS_LOCATION = "surfcast.location";
export const LS_THEME = "surfcast.theme";
export const LS_ALERTS = "surfcast.alerts";

/** Text-alert sensitivity presets — the surf score at/above which we text. */
export const ALERT_SENSITIVITY = [
  { key: "fair", label: "Fair & up", min: 45, hint: "more texts" },
  { key: "good", label: "Good & up", min: 62, hint: "balanced" },
  { key: "epic", label: "Only epic", min: 80, hint: "rare" },
] as const;

/** Daylight window (local hours) used for the day-level surf summary + auto theme. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 19;

/** Open-Meteo endpoints (all free, no API key). */
export const OPEN_METEO = {
  marine: "https://marine-api.open-meteo.com/v1/marine",
  forecast: "https://api.open-meteo.com/v1/forecast",
  geocode: "https://geocoding-api.open-meteo.com/v1/search",
};

/** NOAA CO-OPS tide predictions datagetter. */
export const NOAA_DATAGETTER =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
/** NOAA metadata API — used to find the nearest tide-prediction station. */
export const NOAA_MDAPI =
  "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json";

/** Cache upstream API responses this many seconds (respect rate limits + speed). */
export const UPSTREAM_REVALIDATE = 1800; // 30 min
