"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAnonSupabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMove() {
    setCreating(true);
    setError(null);
    const supabase = getAnonSupabase();
    const { data, error } = await supabase
      .rpc("create_move", {})
      .single<{ id: string; share_token: string }>();

    if (error || !data) {
      setError(error?.message ?? "Failed to create move");
      setCreating(false);
      return;
    }
    router.push(`/m/${data.share_token}`);
  }

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
          Create a move, get a private link, and share it with the person moving
          with you. No accounts.
        </p>

        <button
          type="button"
          onClick={startMove}
          disabled={creating}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {creating ? "Creating…" : "Start a new move"}
        </button>

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
