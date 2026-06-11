"use client";

import { useMemo, useState } from "react";
import type { DayForecast, Location } from "@/lib/types";
import { DEFAULT_LOCATION, LS_LOCATION, LS_ALERTS } from "@/lib/config";
import { cn } from "@/lib/format";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useForecast } from "@/hooks/useForecast";
import { ThemeToggle } from "@/components/ThemeToggle";
import LocationSearch from "@/components/LocationSearch";
import WeekStrip from "@/components/WeekStrip";
import { TideChart } from "@/components/TideChart";
import DayDetail from "@/components/DayDetail";
import AlertSheet, { type AlertPrefs } from "@/components/AlertSheet";

/** Header bell button — opens the surf-alert preferences sheet. */
function AlertButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Surf alert settings"
      title="Surf alerts"
      className="group relative grid size-10 place-items-center rounded-full glass-strong text-primary transition-transform active:scale-90"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {active && (
        <span
          className="absolute right-1.5 top-1.5 size-2 rounded-full"
          style={{ background: "var(--good)", boxShadow: "0 0 0 2px var(--surface-solid)" }}
          aria-hidden
        />
      )}
    </button>
  );
}

export function Dashboard() {
  // Persisted, SSR-safe selected location.
  const [location, setLocation] = useLocalStorage<Location>(
    LS_LOCATION,
    DEFAULT_LOCATION
  );

  const { bundle, loading, error, reload } = useForecast(location);

  // Surf-alert preferences (for the header bell's "on" dot + the sheet).
  const [alertPrefs] = useLocalStorage<AlertPrefs>(LS_ALERTS, {
    enabled: false,
    phone: "",
    minScore: 62,
    locationName: "",
  });
  const [alertOpen, setAlertOpen] = useState(false);

  // User's explicit day pick. Empty ("") means "no explicit pick yet" — we then
  // derive the day from the bundle's today. Children always receive the resolved
  // `selectedDay.date`, so we never need an effect to "snap" this into state.
  const [selectedDate, setSelectedDate] = useState<string>("");

  const selectedDay: DayForecast | undefined = useMemo(() => {
    if (!bundle) return undefined;
    return (
      bundle.days.find((d) => d.date === selectedDate) ??
      bundle.days.find((d) => d.date === bundle.todayKey) ??
      bundle.days[0]
    );
  }, [bundle, selectedDate]);

  function handleSelectPlace(next: Location) {
    setLocation(next);
    setSelectedDate(""); // force snap-to-today for the new place
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {/* z-50 so the search dropdown layers above the cards below it. */}
      <header className="relative z-50 flex flex-col gap-3 animate-rise">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <AlertButton
            active={alertPrefs.enabled}
            onClick={() => setAlertOpen(true)}
          />
          <span className="text-center font-display text-[21px] font-semibold italic leading-none tracking-tight text-primary">
            SurfCast
          </span>
          <ThemeToggle />
        </div>

        {/* Self-contained: renders the current location and opens its own search
            panel; hands back a fully-resolved Location on select. */}
        <LocationSearch current={location} onSelect={handleSelectPlace} />
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {error && !loading ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !bundle || !selectedDay ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="animate-rise" style={{ animationDelay: "40ms" }}>
            <WeekStrip
              days={bundle.days}
              selectedDate={selectedDay.date}
              todayKey={bundle.todayKey}
              onSelectDate={setSelectedDate}
            />
          </div>

          <div className="animate-rise" style={{ animationDelay: "90ms" }}>
            <TideChart
              curve={bundle.tideCurve}
              extremes={bundle.tideExtremes}
              days={bundle.days}
              selectedDate={selectedDay.date}
              todayKey={bundle.todayKey}
              nowLocalISO={bundle.nowLocalISO}
              onSelectDate={setSelectedDate}
            />
          </div>

          <div className="animate-rise" style={{ animationDelay: "140ms" }}>
            <DayDetail day={selectedDay} location={bundle.location} />
          </div>
        </div>
      )}

      <AlertSheet
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        location={location}
      />
    </div>
  );
}

/* ── Loading skeleton (frosted shimmer) ─────────────────────────────────── */
function LoadingState() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      {/* Week strip skeleton */}
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-[88px] w-[60px] shrink-0 rounded-3xl" />
        ))}
      </div>

      {/* Hero tide chart skeleton */}
      <Shimmer className="h-[352px] w-full rounded-3xl" />

      {/* Day detail skeleton */}
      <div className="grid grid-cols-2 gap-3.5">
        <Shimmer className="h-28 rounded-3xl" />
        <Shimmer className="h-28 rounded-3xl" />
        <Shimmer className="col-span-2 h-40 rounded-3xl" />
      </div>

      <span className="sr-only">Loading forecast…</span>
    </div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden glass", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

/* ── Error state ────────────────────────────────────────────────────────── */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center animate-rise">
      <span
        className="grid size-12 place-items-center rounded-2xl"
        style={{ background: "var(--tide-fill)" }}
        aria-hidden
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 8v5M12 16.5h.01"
            stroke="var(--poor)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="9" stroke="var(--poor)" strokeWidth="1.6" opacity="0.5" />
        </svg>
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">Couldn’t load the forecast</p>
        <p className="text-sm text-muted">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97]"
      >
        Try again
      </button>
    </div>
  );
}
