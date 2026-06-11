"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Location, PlaceResult } from "@/lib/types";
import { cn } from "@/lib/format";

/**
 * The search endpoint returns geocoding `PlaceResult`s, each already paired with
 * its nearest NOAA tide-prediction station. We extend the shared contract here
 * (intersection — not a redefinition) rather than inventing a parallel shape.
 */
type SearchResult = PlaceResult & {
  stationId: string;
  stationName?: string;
};

interface LocationSearchProps {
  current: Location;
  onSelect: (place: {
    name: string;
    lat: number;
    lon: number;
    timezone: string;
    stationId: string;
    stationName?: string;
  }) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

export default function LocationSearch({
  current,
  onSelect,
}: LocationSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false); // a search has actually run
  const [active, setActive] = useState(0); // keyboard-highlighted row

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY;

  // ── Debounced fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) {
      setResults([]);
      setLoading(false);
      setTouched(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    setLoading(true);

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/location/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const data = (await res.json()) as SearchResult[] | { results?: SearchResult[] };
        const list = Array.isArray(data) ? data : (data.results ?? []);
        if (!alive) return;
        setResults(list);
        setActive(0);
        setTouched(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!alive) return;
        setResults([]);
        setTouched(true);
      } finally {
        if (alive) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [trimmed, ready]);

  // ── Close on outside click / Escape ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setTouched(false);
    setActive(0);
    inputRef.current?.blur();
  }, []);

  const pick = useCallback(
    (r: SearchResult) => {
      onSelect({
        name: r.label || r.name,
        lat: r.lat,
        lon: r.lon,
        timezone: r.timezone,
        stationId: r.stationId,
        stationName: r.stationName,
      });
      close();
    },
    [onSelect, close],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (query) {
          setQuery("");
          setResults([]);
          setTouched(false);
        } else {
          close();
        }
        return;
      }
      if (!results.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[active];
        if (r) pick(r);
      }
    },
    [results, active, query, close, pick],
  );

  const showPanel = open && ready;

  const status: "loading" | "results" | "empty" =
    loading && !results.length
      ? "loading"
      : results.length
        ? "results"
        : touched
          ? "empty"
          : "loading";

  const currentLabel = useMemo(() => current.name, [current.name]);

  return (
    <div ref={rootRef} className="relative w-full">
      {/* ── Input shell ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          "glass flex items-center gap-2.5 rounded-2xl px-3.5 transition-all duration-300",
          open
            ? "h-12 ring-2 ring-[var(--ring)]"
            : "h-12 hover:border-border",
        )}
      >
        <SearchGlyph spinning={loading && open} />

        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          placeholder={open ? "Search a town or beach…" : currentLabel}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && results.length ? `${listId}-opt-${active}` : undefined
          }
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none",
            "text-text placeholder:text-faint placeholder:font-normal",
            !open && "placeholder:text-text placeholder:font-medium",
          )}
        />

        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setResults([]);
              setTouched(false);
              inputRef.current?.focus();
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-strong hover:text-text"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          !open && <Kbd>⌕</Kbd>
        )}
      </div>

      {/* ── Dropdown panel ────────────────────────────────────────────────── */}
      {showPanel && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-2xl border border-border p-1.5 animate-rise"
          style={{
            animationDuration: "0.22s",
            background: "var(--surface-solid)",
            boxShadow: "var(--shadow)",
          }}
        >
          {status === "loading" && <LoadingRows />}

          {status === "empty" && (
            <EmptyState
              title="No matches"
              hint={`Nothing found for “${trimmed}”. Try a nearby town.`}
            />
          )}

          {status === "results" && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search results"
              className="flex flex-col"
            >
              {results.map((r, i) => {
                const isActive = i === active;
                const isCurrent =
                  Math.abs(r.lat - current.lat) < 1e-4 &&
                  Math.abs(r.lon - current.lon) < 1e-4;
                return (
                  <li key={`${r.lat},${r.lon},${i}`} role="presentation">
                    <button
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(r)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150",
                        isActive ? "bg-primary/12" : "hover:bg-surface",
                      )}
                    >
                      <PinGlyph active={isActive} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-text">
                          {r.name}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {regionLine(r)}
                        </span>
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                          Current
                        </span>
                      ) : (
                        <Return active={isActive} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function regionLine(r: SearchResult): string {
  const parts = [r.admin1, r.country].filter(Boolean);
  const place = parts.join(", ");
  if (r.stationName) {
    return place ? `${place} · ${r.stationName}` : r.stationName;
  }
  return place || "—";
}

function SearchGlyph({ spinning }: { spinning: boolean }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center text-faint">
      {spinning ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
          className="animate-spin"
          style={{ animationDuration: "0.7s" }}
        >
          <path d="M21 12a9 9 0 1 1-6.2-8.6" opacity="0.9" />
        </svg>
      ) : (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      )}
    </span>
  );
}

function PinGlyph({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150",
        active ? "bg-primary/15 text-primary" : "bg-surface text-faint",
      )}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" />
        <circle cx="12" cy="11" r="2.2" />
      </svg>
    </span>
  );
}

function Return({ active }: { active: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "shrink-0 transition-opacity duration-150",
        active ? "text-primary opacity-100" : "text-faint opacity-0",
      )}
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-6 min-w-6 place-items-center rounded-md border border-hairline bg-surface px-1.5 text-[12px] font-medium text-faint">
      {children}
    </span>
  );
}

function LoadingRows() {
  return (
    <ul className="flex flex-col" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 px-2.5 py-2.5"
          style={{
            animation: "pulse-now 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.12}s`,
          }}
        >
          <span className="h-8 w-8 shrink-0 rounded-lg bg-surface" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className="h-3 rounded-full bg-surface"
              style={{ width: `${68 - i * 12}%` }}
            />
            <span
              className="h-2.5 rounded-full bg-surface"
              style={{ width: `${44 - i * 8}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-faint">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </span>
      <p className="text-[14px] font-semibold text-text">{title}</p>
      <p className="max-w-[16rem] text-[12.5px] leading-snug text-muted">
        {hint}
      </p>
    </div>
  );
}
