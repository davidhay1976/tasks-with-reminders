"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getMoveSupabase } from "@/lib/supabase";
import type { Task } from "@/lib/types";

export default function MovePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const supabase = useMemo(() => getMoveSupabase(token), [token]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${token}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, token, load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    // We need the move_id — one round-trip; cache would be nice but for now it's cheap.
    const { data: move, error: moveErr } = await supabase
      .from("moves")
      .select("id")
      .single<{ id: string }>();
    if (moveErr || !move) {
      setError(moveErr?.message ?? "Move not found for this link");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      move_id: move.id,
      title,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewTitle("");
    // realtime will refresh; but call load() for immediate feedback if realtime lags.
    load();
  }

  async function toggle(task: Task) {
    const next = task.status === "todo" ? "done" : "todo";
    const { error } = await supabase
      .from("tasks")
      .update({ status: next })
      .eq("id", task.id);
    if (error) setError(error.message);
  }

  async function remove(task: Task) {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) setError(error.message);
  }

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-lg items-baseline justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Your move
          </h1>
          <p className="text-sm text-zinc-500">
            {todoCount} to do · {doneCount} done
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            Add
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <ul className="mt-6 space-y-1">
          {loading && (
            <li className="py-6 text-center text-sm text-zinc-500">Loading…</li>
          )}
          {!loading && tasks.length === 0 && (
            <li className="py-10 text-center text-sm text-zinc-500">
              No tasks yet. Add the first one above.
            </li>
          )}
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={task.status === "done"}
                onChange={() => toggle(task)}
                className="h-5 w-5 accent-zinc-900 dark:accent-white"
              />
              <span
                className={
                  task.status === "done"
                    ? "flex-1 text-zinc-400 line-through"
                    : "flex-1 text-zinc-900 dark:text-zinc-100"
                }
              >
                {task.title}
              </span>
              <button
                type="button"
                onClick={() => remove(task)}
                aria-label="Delete task"
                className="text-zinc-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
