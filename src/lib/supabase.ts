// Server-only Supabase client for SurfCast's alert subscriptions.
// Uses the publishable key, which in this app is NEVER shipped to the browser —
// the client talks only to our /api routes, which call Supabase here. All table
// access is mediated by SECURITY DEFINER RPCs (the table itself is RLS-locked).
// Returns null when Supabase isn't configured so the app degrades gracefully.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (cached) return cached;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
