"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAnonSupabase, getMoveSupabase } from "@/lib/supabase";
import { USA_TEMPLATE, ISRAEL_TEMPLATE, computeDueAt } from "@/lib/template";
import {
  listRecentMoves,
  rememberMove,
  forgetMove,
  type RecentMove,
} from "@/lib/recent";

export default function Home() {
  const router = useRouter();
  const [moveDate, setMoveDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentMove[]>([]);

  useEffect(() => {
    setRecents(listRecentMoves());
  }, []);

  async function startMove(e: React.FormEvent) {
    e.preventDefault();
    const chosenDate = moveDate || defaultDate;
    if (!chosenDate) return;
    setCreating(true);
    setError(null);

    const anon = getAnonSupabase();
    const { data: move, error: createErr } = await anon
      .rpc("create_move", { p_move_date: chosenDate })
      .single<{ id: string; share_token: string }>();

    if (createErr || !move) {
      setError(createErr?.message ?? "Failed to create move");
      setCreating(false);
      return;
    }

    const scoped = getMoveSupabase(move.share_token);
    const rows = [...USA_TEMPLATE, ...ISRAEL_TEMPLATE].map((item) => ({
      move_id: move.id,
      title: item.title,
      category: item.category,
      side: item.side,
      room: item.room,
      due_at: computeDueAt(chosenDate, item.offset_days),
    }));
    const { error: insertErr } = await scoped.from("tasks").insert(rows);
    if (insertErr) {
      console.warn("Template insert failed:", insertErr.message);
    }

    rememberMove({
      token: move.share_token,
      move_date: chosenDate,
      origin_country: "USA",
      destination_country: "Israel",
    });

    router.push(`/m/${move.share_token}`);
  }

  function handleForget(token: string) {
    forgetMove(token);
    setRecents(listRecentMoves());
  }

  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-md px-6 py-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Tasks with Reminders
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            A shared checklist for your move
          </h1>
        </div>

        {recents.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Continue a move
            </h2>
            <ul className="mt-3 space-y-2">
              {recents.map((m) => (
                <li
                  key={m.token}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <Link
                    href={`/m/${m.token}`}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {m.origin_country} → {m.destination_country}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {m.move_date
                        ? `Moving ${formatDate(m.move_date)}`
                        : "No date set"}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleForget(m.token)}
                    aria-label="Remove from this device"
                    className="text-zinc-400 hover:text-red-600"
                    title="Remove from this device only"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          {recents.length > 0 && (
            <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Or start fresh
            </h2>
          )}
          {recents.length === 0 && (
            <p className="text-center text-zinc-600 dark:text-zinc-400">
              Pick your move date and we&rsquo;ll set up the standard checklist.
              Share the link with the person moving with you — no accounts.
            </p>
          )}

          <form onSubmit={startMove} className="mt-3 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Move date
              </span>
              <input
                type="date"
                required
                value={moveDate || defaultDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {creating ? "Setting up…" : "Start a new move"}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-zinc-500">
          Already have a link? Just open it — it&rsquo;s the whole login.
        </p>
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
