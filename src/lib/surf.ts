// ───────────────────────────────────────────────────────────────────────────
// surf.ts — the surf-quality scoring brain for SurfCast.
//
// Pure functions only: no I/O, no React, no Date-of-day assumptions beyond the
// hour field on a SurfHour. Everything here is deterministic and unit-testable.
//
// CALIBRATION TARGET
// ------------------
// Stone Harbor, NJ is a mid-Atlantic beach break that faces ~ESE. A typical
// summer should surface roughly 1–3 *genuinely good* mornings per week — not
// every day, not once a month. Summer here is dominated by small, short-period
// windswell (0–2 ft, 5–8 s) which we want to keep parked in flat/poor territory,
// while the occasional clean morning (chest-high-plus, ~8 s+, light/offshore
// wind) should pop into good/epic. Fall/winter groundswell + hurricane swell is
// what actually lights up the higher ratings.
//
// Sources informing the thresholds (NJ beach-break behavior, period bands,
// groundswell vs windswell, closeouts at size):
//   - surf-forecast.com / swellinfo.com / deepswell.com NJ reports: summer surf
//     averages 0–2 ft with 5–9 s periods; best when SE swell meets NW (offshore)
//     wind.
//   - Surfline "Wave Period Explained" / groundswell-vs-windswell: <10 s = wind-
//     swell (weaker, choppier); 7–9 s surfable but soft; 10–12 s good quality.
//   - Beach breaks close out / blow out as size climbs; high-surf warnings ~15 ft.
//
// All thresholds below are intentionally grouped and commented so they can be
// re-tuned later without touching the combination logic.
// ───────────────────────────────────────────────────────────────────────────

import type { SurfScore, SurfRating, SurfHour } from "@/lib/types";

/**
 * Stone Harbor's beach faces roughly ESE (~110°). The *offshore* wind — the
 * clean-grooming wind that blows from the land out over the wave — therefore
 * comes from ~290° (110 + 180). Onshore wind blows from ~110° (off the ocean).
 */
export const COAST_FACING_DEG = 110;

/** Daylight window (local hours) used by summarizeDay for the day-level verdict.
 *  Mirrors DAY_START_HOUR/DAY_END_HOUR in config.ts; kept local so surf.ts has
 *  zero config coupling and stays a pure scoring island. */
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 19;

// ── Combination weights ──────────────────────────────────────────────────────
// Wave size matters most (no swell = no surf), then wind (clean vs blown out),
// then period (organization / power). They sum to 1.
const W_WAVE = 0.5;
const W_WIND = 0.3;
const W_PERIOD = 0.2;

// ── Small math helpers ───────────────────────────────────────────────────────

/** Clamp n into [lo, hi]. */
function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Linear interpolation across breakpoints. `points` is sorted ascending by x.
 *  Below the first / above the last point we clamp to the end y-values. This is
 *  how every sub-score curve below is expressed: a few human-readable knees. */
function piecewise(x: number, points: Array<[number, number]>): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Smallest absolute angular difference between two bearings, in [0, 180]. */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(((a - b) % 360) + 360) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// ── Sub-score: WAVE SIZE ─────────────────────────────────────────────────────
//
// waveHeight is significant wave height in feet (face/peaks run a bit bigger).
// Sweet spot is roughly waist-to-head-high peaks. Tiny is flat, huge closes out.
//
//   <1.5 ft  → ~flat (nothing to ride)
//   2.5–5 ft → the money zone, best around 3.5 ft (chest/head-high peaks)
//   5–7 ft   → still good but heavier/less forgiving, eases down
//   >8 ft    → beach-break closeouts / blown-out, penalized hard
//
function waveScore(waveHeight: number): number {
  return clamp(
    piecewise(waveHeight, [
      [0.0, 0], // dead flat
      [1.0, 6], // ankle slop
      [1.5, 16], // barely surfable on a longboard
      [2.0, 34], // knee–waist, marginal
      [2.5, 52], // waist-high, fun-ish but small
      [3.0, 68], // waist/chest, getting good
      [3.5, 80], // chest-high peaks — properly fun
      [4.0, 90], // chest/head-high — very good
      [4.5, 97], // head-high — excellent
      [5.0, 100], // head-high+ — peak score
      [6.0, 88], // overhead, heavier
      [7.0, 64], // well overhead, getting unruly for a beachie
      [8.0, 46], // closeout-prone
      [10.0, 24], // mostly closeouts / paddle battle
      [13.0, 8], // blown out / high-surf-warning territory
    ]),
  );
}

// ── Sub-score: SWELL PERIOD ──────────────────────────────────────────────────
//
// Period (seconds) separates organized groundswell from local windslop.
//
//   <5 s    → pure wind chop, disorganized, weak
//   6–7 s   → typical NJ summer windswell, soft but surfable
//   8 s     → respectable, lining up
//   9–11 s  → groundswell, clean and powerful — high score
//   12 s+   → long-period hurricane/distant groundswell — best
//
function periodScore(wavePeriod: number): number {
  return clamp(
    piecewise(wavePeriod, [
      [3, 8], // sea state, not real swell
      [4, 18],
      [5, 30], // borderline windslop
      [6, 46], // soft summer windswell
      [7, 60], // surfable, a little weak
      [8, 74], // good organization
      [9, 86], // groundswell
      [10, 94],
      [11, 98],
      [13, 100], // long-period groundswell — capped at top
    ]),
  );
}

// ── Sub-score: WIND ──────────────────────────────────────────────────────────
//
// windDirection is the bearing the wind blows FROM (meteorological convention),
// matching how the marine/weather APIs report it.
//
// Offshore bearing = (coastFacingDeg + 180) mod 360. Wind FROM near that bearing
// grooms the face → clean. Wind FROM near coastFacingDeg is onshore → choppy /
// blown out. Cross-shore is in between. Magnitude matters a lot: light wind from
// any direction is glassy and fine; strong onshore wind destroys the surf.
//
function windScore(
  windSpeed: number,
  windDirection: number,
  coastFacingDeg: number,
): number {
  const offshoreDeg = (coastFacingDeg + 180) % 360;

  // 0 = perfectly offshore, 180 = perfectly onshore (straight off the ocean).
  const offOnAxis = angleDiff(windDirection, offshoreDeg);

  // Directional quality multiplier in [0,1]:
  //   offshore (axis ~0°)         → ~1.0  (grooms the wave)
  //   cross-shore (axis ~90°)     → ~0.55 (textured but rideable)
  //   onshore (axis ~180°)        → ~0.05 (chop / blown out)
  // Cosine gives a smooth offshore→onshore falloff; remap from [-1,1] to a
  // floor of ~0.05 so dead-onshore is bad but not a hard zero.
  const cosAxis = Math.cos((offOnAxis * Math.PI) / 180); // 1 offshore … -1 onshore
  const dirQuality = 0.05 + 0.95 * ((cosAxis + 1) / 2); // 1.0 … 0.05

  // Light wind is glassy regardless of direction — under ~5 mph nothing gets
  // groomed *or* chopped, so direction barely matters. We blend the direction
  // quality toward "clean" as wind drops toward calm.
  const lightBlend = clamp((windSpeed - 2) / 8, 0, 1); // 0 at <=2mph … 1 at >=10mph
  const effectiveQuality = dirQuality + (1 - dirQuality) * (1 - lightBlend);

  // Base score from magnitude: even perfect offshore gets sandblasted if it's
  // howling. Light-to-moderate is ideal; strong wind erodes the ceiling.
  //   <=4 mph   → glassy, 100
  //   ~10 mph   → still clean-ish if offshore
  //   ~18 mph   → strong, marginal
  //   >=26 mph  → storm, junk
  const magBase = clamp(
    piecewise(windSpeed, [
      [0, 100],
      [4, 100], // glassy
      [8, 92],
      [12, 78],
      [16, 60],
      [20, 42],
      [26, 22],
      [34, 8],
    ]),
  );

  // Strong onshore is the worst case — make magnitude bite harder when the wind
  // is onshore by scaling the magnitude penalty through the direction quality.
  // effectiveQuality already encodes direction; multiply so clean wind keeps its
  // magnitude score and onshore wind collapses.
  return clamp(magBase * effectiveQuality);
}

// ── Rating bands ─────────────────────────────────────────────────────────────

/** Map a 0–100 score to a rating bucket.
 *  flat <20, poor <40, fair <60, good <78, else epic. */
export function ratingOf(score: number): SurfRating {
  if (score < 20) return "flat";
  if (score < 40) return "poor";
  if (score < 60) return "fair";
  if (score < 78) return "good";
  return "epic";
}

// ── Labels + reasons ─────────────────────────────────────────────────────────

/** Short human verdict, chosen from rating + the dominant limiting factor. */
function labelFor(
  rating: SurfRating,
  f: { wave: number; period: number; wind: number },
  waveHeight: number,
): string {
  switch (rating) {
    case "flat":
      return waveHeight < 1.2 ? "Flat" : "Tiny & weak";
    case "poor":
      // What's holding it back the most?
      if (f.wind < 45) return "Junky & blown out";
      if (f.wave < 45) return "Small & soft";
      return "Weak & disorganized";
    case "fair":
      if (f.wind < 55) return "Surfable but textured";
      if (f.period < 55) return "Soft but rideable";
      return "Fun-ish";
    case "good":
      return "Clean & fun";
    case "epic":
      return waveHeight >= 5 ? "Pumping" : "Firing";
    default:
      return "—";
  }
}

/** 1–3 short bullet reasons explaining the verdict. */
function reasonsFor(
  input: {
    waveHeight: number;
    wavePeriod: number;
    windSpeed: number;
    windDirection: number;
    coastFacingDeg: number;
  },
  f: { wave: number; period: number; wind: number },
): string[] {
  const { waveHeight, wavePeriod, windSpeed, windDirection, coastFacingDeg } =
    input;
  const reasons: string[] = [];

  // ── Wave size note ──
  if (waveHeight < 1.5) {
    reasons.push("too small to ride");
  } else if (waveHeight > 8) {
    reasons.push("oversized, closing out");
  } else if (f.wave >= 85) {
    reasons.push(
      waveHeight >= 5 ? "solid overhead sets" : "fun chest-high peaks",
    );
  } else if (waveHeight < 2.5) {
    reasons.push("small, knee-to-waist");
  } else if (waveHeight > 6) {
    reasons.push("big and heavy");
  }

  // ── Period note ──
  if (wavePeriod >= 10) {
    reasons.push(`clean ${Math.round(wavePeriod)}s groundswell`);
  } else if (wavePeriod >= 8) {
    reasons.push(`organized ${Math.round(wavePeriod)}s swell`);
  } else if (wavePeriod <= 6) {
    reasons.push("short-period windswell");
  }

  // ── Wind note ──
  const offshoreDeg = (coastFacingDeg + 180) % 360;
  const offOnAxis = angleDiff(windDirection, offshoreDeg);
  const isLight = windSpeed < 5;
  const isOffshore = offOnAxis < 60;
  const isOnshore = offOnAxis > 120;
  if (isLight) {
    reasons.push("light wind, glassy");
  } else if (isOnshore && windSpeed >= 12) {
    reasons.push("strong onshore wind");
  } else if (isOnshore) {
    reasons.push("onshore wind, textured");
  } else if (isOffshore && windSpeed >= 6) {
    reasons.push(
      windSpeed >= 22 ? "strong offshore, bumpy" : "offshore, grooming it",
    );
  } else if (windSpeed >= 18) {
    reasons.push("windy and sideways");
  }

  // Keep it tight: at most 3 bullets, prefer the most informative ones.
  return reasons.slice(0, 3);
}

// ── Public: score one hour ───────────────────────────────────────────────────

/**
 * Score a single hour of conditions into a SurfScore.
 * `coastFacingDeg` defaults to Stone Harbor's orientation but is parameterized
 * so the same brain works for any beach.
 */
export function scoreHour(input: {
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: number;
  coastFacingDeg?: number;
}): SurfScore {
  const coastFacingDeg = input.coastFacingDeg ?? COAST_FACING_DEG;

  // Guard against missing / nonsense upstream values.
  const waveHeight = Number.isFinite(input.waveHeight)
    ? Math.max(0, input.waveHeight)
    : 0;
  const wavePeriod = Number.isFinite(input.wavePeriod)
    ? Math.max(0, input.wavePeriod)
    : 0;
  const windSpeed = Number.isFinite(input.windSpeed)
    ? Math.max(0, input.windSpeed)
    : 0;
  const windDirection = Number.isFinite(input.windDirection)
    ? input.windDirection
    : 0;

  const wave = waveScore(waveHeight);
  const period = periodScore(wavePeriod);
  const wind = windScore(windSpeed, windDirection, coastFacingDeg);

  // Weighted blend.
  let score = wave * W_WAVE + wind * W_WIND + period * W_PERIOD;

  // ── Gating: surf is gated by its weakest essential ingredient ──
  // No swell ⇒ no surf, no matter how clean the wind or long the period. The
  // wave size sets a hard ceiling on the whole day so that a glassy, perfectly-
  // groomed *small* morning can't ride wind + period up into "good". This is the
  // single most important calibration lever: it's what keeps the everyday NJ
  // summer 1–2.5 ft windswell parked in flat/poor/fair and reserves good/epic
  // for mornings with genuine chest-high-plus size.
  //
  //   <1.0 ft → flat ceiling ~14   (nothing to ride)
  //   1.5 ft  → ~30  (poor)        2.0 ft → ~45 (fair edge)
  //   2.5 ft  → ~58  (fair)        3.0 ft → ~72 (good edge)
  //   ≥3.5 ft → no size cap (clean conditions can reach good/epic)
  const sizeCeiling = clamp(
    piecewise(waveHeight, [
      [0.0, 10],
      [1.0, 14],
      [1.5, 30],
      [2.0, 45],
      [2.5, 58],
      [3.0, 72],
      [3.5, 100], // size no longer the binding constraint
    ]),
  );
  score = Math.min(score, sizeCeiling);

  // Blown-out onshore gale shouldn't sneak into "good" off a big clean wave
  // sub-score alone — junky wind caps the ceiling regardless of size/period.
  if (wind < 30) {
    score = Math.min(score, 56);
  }

  // ── "Epic" is a groundswell event, not just a clean chest-high day ──
  // A genuinely epic NJ session is head-high-PLUS, long-period, clean — the kind
  // of swell that only shows up a handful of times a season. So the very top of
  // the scale (≥78, the epic band) is reserved for hours that combine real size
  // with real organization. If the swell is good but not both head-high AND
  // groundswell-period, hold it at the top of "good" (77) so the canonical clean
  // chest-high morning reads as a great *good* day rather than diluting "epic".
  const epicWorthy = wave >= 88 && period >= 82; // ~head-high + ~9.5s+
  if (!epicWorthy) {
    score = Math.min(score, 77);
  }

  score = Math.round(clamp(score));

  const factors = {
    wave: Math.round(wave),
    period: Math.round(period),
    wind: Math.round(wind),
  };
  const rating = ratingOf(score);
  const label = labelFor(rating, factors, waveHeight);
  const reasons = reasonsFor(
    { waveHeight, wavePeriod, windSpeed, windDirection, coastFacingDeg },
    factors,
  );

  return { score, rating, label, factors, reasons };
}

// ── Public: summarize a day ──────────────────────────────────────────────────

/**
 * Day-level verdict = the best single daylight hour (06:00–19:00). Surfers plan
 * around the best window of the day, so the day's headline reflects its peak
 * rideable hour rather than a washed-out 24h average. Falls back to the overall
 * best hour if no daylight hours are present.
 */
export function summarizeDay(hours: SurfHour[]): SurfScore {
  if (!hours || hours.length === 0) {
    return {
      score: 0,
      rating: "flat",
      label: "No data",
      factors: { wave: 0, period: 0, wind: 0 },
      reasons: ["no forecast data"],
    };
  }

  const daylight = hours.filter(
    (h) => h.hour >= DAY_START_HOUR && h.hour <= DAY_END_HOUR,
  );
  const pool = daylight.length > 0 ? daylight : hours;

  // Pick the peak hour by its precomputed score, then re-derive the full
  // SurfScore (label/reasons/factors) from that hour's raw conditions so the
  // headline verdict is internally consistent with scoreHour.
  let best = pool[0];
  for (const h of pool) if (h.score > best.score) best = h;

  return scoreHour({
    waveHeight: best.waveHeight,
    wavePeriod: best.wavePeriod,
    windSpeed: best.windSpeed,
    windDirection: best.windDirection,
    coastFacingDeg: COAST_FACING_DEG,
  });
}
