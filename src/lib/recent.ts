// Tiny device-local record of moves this browser has interacted with,
// so the landing page can offer a shortcut back to them. The move URL
// itself is the source of truth — this is just convenience.

const KEY = "recent_moves_v1";
const MAX = 8;

export interface RecentMove {
  token: string;
  move_date: string | null;
  origin_country: string;
  destination_country: string;
  last_seen: string; // ISO
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listRecentMoves(): RecentMove[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is RecentMove => typeof m?.token === "string")
      .sort((a, b) => b.last_seen.localeCompare(a.last_seen));
  } catch {
    return [];
  }
}

export function rememberMove(entry: Omit<RecentMove, "last_seen">): void {
  if (!isBrowser()) return;
  try {
    const now = new Date().toISOString();
    const existing = listRecentMoves().filter((m) => m.token !== entry.token);
    const next = [{ ...entry, last_seen: now }, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked (private mode, disabled) — silently no-op.
  }
}

export function forgetMove(token: string): void {
  if (!isBrowser()) return;
  try {
    const next = listRecentMoves().filter((m) => m.token !== token);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
