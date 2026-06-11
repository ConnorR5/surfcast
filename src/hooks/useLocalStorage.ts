"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SSR-safe persistent state backed by localStorage.
 *
 * To avoid React hydration mismatches, the very first render (server + client
 * initial paint) always returns `initial`. We hydrate from localStorage in a
 * post-mount effect, then keep writing changes back. Cross-tab updates are
 * picked up via the `storage` event.
 *
 * The stored value is JSON-encoded. A bad/corrupt entry falls back to `initial`.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start from `initial` so server and first client render agree.
  const [value, setValue] = useState<T>(initial);

  // Hydrate from localStorage after mount (client only). This deliberately
  // synchronizes React state with the browser storage external system, so the
  // post-mount setState is intentional (and required to dodge a hydration
  // mismatch — we cannot read storage during the server render).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Ignore parse/access errors — keep `initial`.
    }
  }, [key]);

  // Stable setter that supports the functional-update form and persists.
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage may be unavailable (private mode / quota) — keep in-memory.
        }
        return resolved;
      });
    },
    [key]
  );

  // Sync when another tab/window writes the same key.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setValue(initial);
        return;
      }
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        // Ignore malformed external writes.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, set];
}
