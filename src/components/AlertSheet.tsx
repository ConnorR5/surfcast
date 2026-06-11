"use client";

import { useEffect, useState } from "react";
import type { Location } from "@/lib/types";
import { LS_ALERTS, ALERT_SENSITIVITY } from "@/lib/config";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/format";

export interface AlertPrefs {
  enabled: boolean;
  phone: string;
  minScore: number;
  locationName: string;
}

const DEFAULT_PREFS: AlertPrefs = {
  enabled: false,
  phone: "",
  minScore: 62,
  locationName: "",
};

interface AlertSheetProps {
  open: boolean;
  onClose: () => void;
  location: Location;
}

type Status = "idle" | "saving" | "saved" | "error";

export default function AlertSheet({ open, onClose, location }: AlertSheetProps) {
  const [prefs, setPrefs] = useLocalStorage<AlertPrefs>(LS_ALERTS, DEFAULT_PREFS);
  const [phone, setPhone] = useState(prefs.phone);
  const [minScore, setMinScore] = useState(prefs.minScore);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  // Sync local form state from storage each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setPhone(prefs.phone);
    setMinScore(prefs.minScore || 62);
    setStatus("idle");
    setMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    setStatus("saving");
    setMsg("");
    setPrefs({ enabled: true, phone, minScore, locationName: location.name });
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          minScore,
          locationName: location.name,
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMsg(
          data.error === "invalid-phone"
            ? "That number doesn't look right — try 10 digits."
            : "Couldn't save just now. Try again.",
        );
        return;
      }
      setStatus("saved");
      setMsg(
        data.confirmation === "sent"
          ? "Saved — check your phone for a confirmation text 🤙"
          : "Saved on this device. (Texts go live once Twilio is connected.)",
      );
    } catch {
      setStatus("error");
      setMsg("Network hiccup — try again.");
    }
  }

  function turnOff() {
    setPrefs({ ...prefs, enabled: false });
    setStatus("idle");
    setMsg("Alerts turned off.");
  }

  const valid = phone.replace(/\D/g, "").length >= 10;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Surf alert settings"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
      />

      <div
        className="relative z-10 w-full max-w-[460px] rounded-t-[28px] border border-border p-5 pb-7 animate-rise sm:rounded-[28px]"
        style={{ background: "var(--surface-solid)", boxShadow: "var(--shadow)" }}
      >
        {/* grab handle (mobile) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />

        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl"
            style={{ background: "var(--tide-fill)" }}
            aria-hidden
          >
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-semibold tracking-tight text-text">
              Surf alerts
            </h2>
            <p className="text-[13px] leading-snug text-muted">
              Get a text the evening before{" "}
              <span className="font-semibold text-text">{location.name}</span> is
              firing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-text"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Phone */}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">
            Your phone
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(609) 555-0123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[16px] font-medium text-text outline-none transition-all placeholder:text-faint focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        {/* Sensitivity */}
        <div className="mt-4">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">
            Text me when it&apos;s…
          </span>
          <div className="grid grid-cols-3 gap-2">
            {ALERT_SENSITIVITY.map((s) => {
              const active = minScore === s.min;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setMinScore(s.min)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 transition-all",
                    active
                      ? "border-transparent bg-primary text-white shadow-sm"
                      : "border-border bg-surface text-text hover:border-[var(--ring)]",
                  )}
                >
                  <span className="text-[13px] font-semibold">{s.label}</span>
                  <span
                    className={cn(
                      "text-[10px]",
                      active ? "text-white/80" : "text-faint",
                    )}
                  >
                    {s.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timing note */}
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-3.5 py-2.5 text-[12.5px] text-muted">
          <ClockIcon />
          Sent around 6 PM the day before — never more than you&apos;d want.
        </p>

        {/* Status */}
        {msg && (
          <p
            className={cn(
              "mt-3 text-[13px] font-medium",
              status === "error" ? "text-poor" : "text-good",
            )}
          >
            {msg}
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={!valid || status === "saving"}
            onClick={save}
            className={cn(
              "flex-1 rounded-2xl px-5 py-3.5 text-[15px] font-semibold text-white transition-all active:scale-[0.98]",
              "bg-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {status === "saving"
              ? "Saving…"
              : prefs.enabled
                ? "Update alerts"
                : "Turn on alerts"}
          </button>
        </div>

        {prefs.enabled && (
          <button
            type="button"
            onClick={turnOff}
            className="mt-3 w-full text-center text-[13px] font-medium text-muted transition-colors hover:text-poor"
          >
            Turn off alerts
          </button>
        )}
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-faint" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
