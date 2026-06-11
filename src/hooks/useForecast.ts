"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ForecastBundle, Location } from "@/lib/types";

interface UseForecastResult {
  bundle: ForecastBundle | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Build the /api/forecast query string from a Location. */
function buildQuery(loc: Location): string {
  const params = new URLSearchParams({
    name: loc.name,
    lat: String(loc.lat),
    lon: String(loc.lon),
    stationId: loc.stationId,
    timezone: loc.timezone,
  });
  if (loc.stationName) params.set("stationName", loc.stationName);
  return params.toString();
}

/**
 * Fetches the unified forecast bundle for a location.
 *
 * Refetches whenever the location identity (the query string) changes, and
 * exposes a manual `reload`. In-flight requests are aborted when the location
 * changes or the component unmounts to avoid setting state from a stale fetch.
 */
export function useForecast(location: Location): UseForecastResult {
  const query = buildQuery(location);

  const [bundle, setBundle] = useState<ForecastBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bumping this triggers a refetch without changing the location.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Track the active request so we can ignore responses from superseded ones.
  const activeRef = useRef(0);

  useEffect(() => {
    const requestId = ++activeRef.current;
    const controller = new AbortController();

    // This effect synchronizes React with an external system (the forecast API).
    // Flipping into the loading state before the request is the intended sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(`/api/forecast?${query}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          let message = `Request failed (${res.status})`;
          try {
            const body = await res.json();
            if (body && typeof body.error === "string") message = body.error;
          } catch {
            // Non-JSON error body — keep the status message.
          }
          throw new Error(message);
        }
        return (await res.json()) as ForecastBundle;
      })
      .then((data) => {
        if (activeRef.current !== requestId) return; // superseded
        setBundle(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // intentionally cancelled
        if (activeRef.current !== requestId) return; // superseded
        setError(
          err instanceof Error ? err.message : "Failed to load forecast."
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, nonce]);

  return { bundle, loading, error, reload };
}
