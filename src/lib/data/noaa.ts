// NOAA CO-OPS tide predictions (datagetter).
// Two products are used: interval=hilo for labeled extremes, interval=h for the
// hourly smooth curve. Times come back local ("YYYY-MM-DD HH:mm") because we pass
// time_zone=lst_ldt; we convert them to local-naive ISO by swapping the space for "T".
// Heights are feet relative to MLLW (units=english).

import { NOAA_DATAGETTER, UPSTREAM_REVALIDATE } from "@/lib/config";
import type { TideExtreme, TideSample } from "@/lib/types";

/** NOAA datagetter wants compact "YYYYMMDD" dates; our keys are "YYYY-MM-DD". */
function compactDate(key: string): string {
  return key.replace(/-/g, "");
}

/** "YYYY-MM-DD HH:mm" (local) -> "YYYY-MM-DDTHH:mm" local-naive ISO. */
function toLocalISO(t: string): string {
  return t.replace(" ", "T");
}

interface DatagetterRow {
  t: string;
  v: string;
  type?: "H" | "L";
}
interface DatagetterResponse {
  predictions?: DatagetterRow[];
  error?: { message?: string };
}

async function fetchDatagetter(
  station: string,
  start: string,
  end: string,
  interval: "hilo" | "h",
): Promise<DatagetterRow[]> {
  const params = new URLSearchParams({
    product: "predictions",
    application: "surfcast",
    datum: "MLLW",
    station,
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
    begin_date: compactDate(start),
    end_date: compactDate(end),
    interval,
  });
  const res = await fetch(`${NOAA_DATAGETTER}?${params.toString()}`, {
    next: { revalidate: UPSTREAM_REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`NOAA datagetter ${interval} failed: ${res.status}`);
  }
  const data = (await res.json()) as DatagetterResponse;
  if (data.error?.message) {
    throw new Error(`NOAA datagetter ${interval}: ${data.error.message}`);
  }
  return data.predictions ?? [];
}

/** Labeled high/low extremes across [start, end] for a station (local dates). */
export async function getTideExtremes(
  station: string,
  start: string,
  end: string,
): Promise<TideExtreme[]> {
  const rows = await fetchDatagetter(station, start, end, "hilo");
  return rows
    .map((r) => ({
      time: toLocalISO(r.t),
      height: Number(r.v),
      type: (r.type ?? "H") as "H" | "L",
    }))
    .filter((e) => Number.isFinite(e.height));
}

/** Hourly tide heights across [start, end] — the smooth curve samples. */
export async function getTideSamples(
  station: string,
  start: string,
  end: string,
): Promise<TideSample[]> {
  const rows = await fetchDatagetter(station, start, end, "h");
  return rows
    .map((r) => ({ time: toLocalISO(r.t), height: Number(r.v) }))
    .filter((s) => Number.isFinite(s.height));
}
