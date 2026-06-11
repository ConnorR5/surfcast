// Small dependency-free formatting + date helpers. Our API timestamps are
// local-naive (already in the location tz), so date math is mostly string work.

/** Tailwind-style className combiner. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "YYYY-MM-DD" date key from a local-naive ISO string. */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Parse a local-naive ISO string ("2026-06-11T14:00") into a Date in local terms.
 *  We intentionally treat it as wall-clock time (no tz shift) for chart math. */
export function parseLocal(iso: string): Date {
  const [d, t = "00:00"] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0);
}

/** Minutes since local midnight for an ISO timestamp. */
export function minutesOfDay(iso: string): number {
  const t = iso.split("T")[1] ?? "00:00";
  const [hh, mm] = t.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Thu" for a "YYYY-MM-DD" key (computed as local civil date). */
export function weekdayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** Day-of-month number for a "YYYY-MM-DD" key. */
export function dayOfMonth(key: string): number {
  return Number(key.split("-")[2]);
}

/** "Jun 14" for a "YYYY-MM-DD" key. */
export function monthDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Thursday, June 14" for a "YYYY-MM-DD" key. */
export function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const full = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const fullM = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${full[new Date(y, m - 1, d).getDay()]}, ${fullM[m - 1]} ${d}`;
}

/** "5:11 AM" from a local-naive ISO string. */
export function clockTime(iso: string): string {
  const t = iso.split("T")[1] ?? "00:00";
  const [rawH, rawM] = t.split(":").map(Number);
  const h24 = Number.isFinite(rawH) ? rawH : 0;
  const minutes = Number.isFinite(rawM) ? rawM : 0;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const hh = h24 % 12 || 12;
  return `${hh}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/** "2PM" compact hour label. */
export function shortHour(iso: string): string {
  let hh = Number((iso.split("T")[1] ?? "00:00").split(":")[0]);
  const ampm = hh >= 12 ? "P" : "A";
  hh = hh % 12 || 12;
  return `${hh}${ampm}`;
}

export function feet(n: number, digits = 1): string {
  return `${n.toFixed(digits)} ft`;
}

export function temp(n: number): string {
  return `${Math.round(n)}°`;
}

/** Compass label from a "coming from" bearing in degrees. */
export function compass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  // Normalize to [0, 360) first so negative bearings don't yield a bad index.
  const norm = ((deg % 360) + 360) % 360;
  return dirs[Math.round(norm / 22.5) % 16];
}

/** Add `n` days to a "YYYY-MM-DD" key, returning a new key. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Current local-naive ISO "now" string at an IANA timezone. */
export function nowLocalISO(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Local civil "YYYY-MM-DD" today at an IANA timezone. */
export function todayKeyAt(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
