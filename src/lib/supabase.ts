import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

// Client with no share_token — only usable for the create_move RPC (SECURITY DEFINER).
export function getAnonSupabase(): SupabaseClient {
  return createClient(url!, anonKey!);
}

// Client scoped to a specific move. RLS policies match rows by the header value.
// Note: the header only reaches REST/RPC calls. Realtime postgres_changes runs
// through a separate auth path (JWT-based) and won't see this header, so
// cross-tab live sync via postgres_changes is currently a known limitation.
// The UI compensates by reloading after every local mutation.
export function getMoveSupabase(shareToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    global: { headers: { "x-share-token": shareToken } },
  });
}
