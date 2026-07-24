"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAnonSupabase, getMoveSupabase } from "@/lib/supabase";
import { USA_TEMPLATE, ISRAEL_TEMPLATE, computeDueAt } from "@/lib/template";

export default function Home() {
  const router = useRouter();
  const [moveDate, setMoveDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMove(e: React.FormEvent) {
    e.preventDefault();
    if (!moveDate) return;
    setCreating(true);
    setError(null);

    const anon = getAnonSupabase();
    const { data: move, error: createErr } = await anon
      .rpc("create_move", { p_move_date: moveDate })
      .single<{ id: string; share_token: string }>();

    if (createErr || !move) {
      setError(createErr?.message ?? "Failed to create move");
      setCreating(false);
      return;
    }

    // Populate both templates (USA + Israel). If this fails we still send the
    // user in — they'll just land on a lighter list and can add tasks manually.
    const scoped = getMoveSupabase(move.share_token);
    const rows = [...USA_TEMPLATE, ...ISRAEL_TEMPLATE].map((item) => ({
      move_id: move.id,
      title: item.title,
      category: item.category,
      side: item.side,
      room: item.room,
      due_at: computeDueAt(moveDate, item.offset_days),
    }));
    const { error: insertErr } = await scoped.from("tasks").insert(rows);
    if (insertErr) {
      console.warn("Template insert failed:", insertErr.message);
    }

    router.push(`/m/${move.share_token}`);
  }

  // Default to 4 weeks out — sensible starting point.
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-md px-6 py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Tasks with Reminders
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          A shared checklist for your move
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Pick your move date and we&rsquo;ll set up the standard checklist.
          Share the link with the person moving with you — no accounts.
        </p>

        <form onSubmit={startMove} className="mt-8 space-y-4 text-left">
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
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <p className="mt-6 text-xs text-zinc-500">
          Already have a link? Just open it — it&rsquo;s the whole login.
        </p>
      </main>
    </div>
  );
}
