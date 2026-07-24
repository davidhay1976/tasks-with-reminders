"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getMoveSupabase } from "@/lib/supabase";
import type { Task, TaskSide } from "@/lib/types";
import {
  USA_ROOMS,
  ISRAEL_ROOMS,
  formatDueLabel,
} from "@/lib/template";

interface MoveHeader {
  id: string;
  move_date: string | null;
  origin_country: string;
  destination_country: string;
}

const GENERAL = "General";

export default function MovePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const supabase = useMemo(() => getMoveSupabase(token), [token]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [move, setMove] = useState<MoveHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"origin" | "destination">("origin");
  const [expanded, setExpanded] = useState<Set<string>>(new Set([`origin:${GENERAL}`, `destination:${GENERAL}`]));

  const load = useCallback(async () => {
    setError(null);
    const [moveRes, tasksRes] = await Promise.all([
      supabase
        .from("moves")
        .select("id, move_date, origin_country, destination_country")
        .single<MoveHeader>(),
      supabase
        .from("tasks")
        .select("*")
        .order("status", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
    ]);

    if (moveRes.error || !moveRes.data) {
      setError(moveRes.error?.message ?? "Move not found for this link.");
      setLoading(false);
      return;
    }
    if (tasksRes.error) {
      setError(tasksRes.error.message);
      setLoading(false);
      return;
    }
    setMove(moveRes.data);
    setTasks(tasksRes.data as Task[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(side: TaskSide, title: string) {
    if (!title.trim() || !move) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    const optimistic: Task = {
      id: tempId,
      move_id: move.id,
      title,
      notes: null,
      due_at: null,
      category: "other",
      status: "todo",
      side,
      room: null,
      reminder_offsets_minutes: [],
      sort_order: 0,
      created_at: now,
      updated_at: now,
    };
    setTasks((prev) => [...prev, optimistic]);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({ move_id: move.id, title, side })
      .select()
      .single<Task>();

    if (error || !data) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setError(error?.message ?? "Insert blocked — check that this link is valid.");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
  }

  async function toggle(task: Task) {
    const next = task.status === "todo" ? "done" : "todo";
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .update({ status: next })
      .eq("id", task.id)
      .select();

    if (error || !data || data.length === 0) {
      setTasks(previous);
      setError(error?.message ?? "Update blocked — RLS didn't see your token.");
    }
  }

  async function remove(task: Task) {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id)
      .select();

    if (error || !data || data.length === 0) {
      setTasks(previous);
      setError(error?.message ?? "Delete blocked — RLS didn't see your token.");
    }
  }

  function toggleRoom(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 'both' tasks are shown in the USA pane per current design.
  const originTasks = tasks.filter((t) => t.side === "origin" || t.side === "both");
  const destinationTasks = tasks.filter((t) => t.side === "destination");

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {move?.move_date ? (
                <>Moving {formatMoveDate(move.move_date)}</>
              ) : (
                "Your move"
              )}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {move ? `${move.origin_country} → ${move.destination_country}` : ""}
              </span>
            </h1>
            {move?.move_date && (
              <p className="text-sm text-zinc-500">
                {formatCountdown(move.move_date)}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {todoCount} to do · {doneCount} done
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Tabs — mobile only */}
        <div className="mb-4 flex gap-2 md:hidden">
          <TabButton
            active={activeTab === "origin"}
            label={move?.origin_country ?? "USA"}
            count={originTasks.filter((t) => t.status === "todo").length}
            onClick={() => setActiveTab("origin")}
          />
          <TabButton
            active={activeTab === "destination"}
            label={move?.destination_country ?? "Israel"}
            count={destinationTasks.filter((t) => t.status === "todo").length}
            onClick={() => setActiveTab("destination")}
          />
        </div>

        <div className="md:grid md:grid-cols-2 md:gap-6">
          <div className={activeTab === "origin" ? "" : "hidden md:block"}>
            <CountryPane
              label={move?.origin_country ?? "USA"}
              side="origin"
              tasks={originTasks}
              rooms={USA_ROOMS}
              loading={loading}
              expanded={expanded}
              onToggleRoom={(room) => toggleRoom(`origin:${room}`)}
              expandedKey={(room) => `origin:${room}`}
              onAdd={(title) => addTask("origin", title)}
              onToggle={toggle}
              onDelete={remove}
            />
          </div>
          <div className={activeTab === "destination" ? "" : "hidden md:block"}>
            <CountryPane
              label={move?.destination_country ?? "Israel"}
              side="destination"
              tasks={destinationTasks}
              rooms={ISRAEL_ROOMS}
              loading={loading}
              expanded={expanded}
              onToggleRoom={(room) => toggleRoom(`destination:${room}`)}
              expandedKey={(room) => `destination:${room}`}
              onAdd={(title) => addTask("destination", title)}
              onToggle={toggle}
              onDelete={remove}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------- Sub-components ----------

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex-1 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          : "flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      }
    >
      {label} <span className="opacity-60">· {count}</span>
    </button>
  );
}

function CountryPane({
  label,
  side,
  tasks,
  rooms,
  loading,
  expanded,
  onToggleRoom,
  expandedKey,
  onAdd,
  onToggle,
  onDelete,
}: {
  label: string;
  side: TaskSide;
  tasks: Task[];
  rooms: string[];
  loading: boolean;
  expanded: Set<string>;
  onToggleRoom: (room: string) => void;
  expandedKey: (room: string) => string;
  onAdd: (title: string) => Promise<void> | void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [newTitle, setNewTitle] = useState("");

  // Group tasks by room label. Include GENERAL for room=null tasks.
  const byRoom = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.room ?? GENERAL;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  // Order: GENERAL first, then predefined rooms in order, then any extras alphabetically.
  const orderedRooms = useMemo(() => {
    const inTasks = new Set(byRoom.keys());
    const ordered: string[] = [GENERAL];
    for (const room of rooms) {
      if (inTasks.has(room)) ordered.push(room);
    }
    // Extras: rooms in tasks that aren't General and aren't in the predefined list
    const extras = Array.from(inTasks).filter(
      (r) => r !== GENERAL && !rooms.includes(r),
    );
    extras.sort();
    return [...ordered, ...extras];
  }, [byRoom, rooms]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    await onAdd(title);
  }

  return (
    <section aria-label={label}>
      <div className="mb-3 hidden items-baseline justify-between md:flex">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {label}
        </h2>
        <p className="text-xs text-zinc-500">
          {tasks.filter((t) => t.status === "todo").length} to do ·{" "}
          {tasks.filter((t) => t.status === "done").length} done
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={`Add to ${label} (general)…`}
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

      <div className="mt-4 space-y-2">
        {loading && (
          <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>
        )}
        {!loading && tasks.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">
            No {label} tasks yet.
          </p>
        )}
        {!loading &&
          orderedRooms.map((room) => {
            const items = byRoom.get(room) ?? [];
            if (items.length === 0 && room === GENERAL) return null;
            const todoCount = items.filter((t) => t.status === "todo").length;
            const isOpen = expanded.has(expandedKey(room));
            return (
              <div
                key={room}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <button
                  type="button"
                  onClick={() => onToggleRoom(room)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <span>
                    {room}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      · {todoCount} to do
                      {items.length - todoCount > 0
                        ? ` · ${items.length - todoCount} done`
                        : ""}
                    </span>
                  </span>
                  <span className="text-zinc-400">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <ul className="border-t border-zinc-200 dark:border-zinc-800">
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={onToggle}
                        onDelete={onDelete}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800">
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggle(task)}
        className="h-5 w-5 accent-zinc-900 dark:accent-white"
      />
      <span
        className={
          task.status === "done"
            ? "flex-1 text-sm text-zinc-400 line-through"
            : "flex-1 text-sm text-zinc-900 dark:text-zinc-100"
        }
      >
        {task.title}
      </span>
      {task.due_at && task.status === "todo" && (
        <DueBadge dueAt={task.due_at} />
      )}
      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label="Delete task"
        className="text-zinc-400 hover:text-red-600"
      >
        ×
      </button>
    </li>
  );
}

function DueBadge({ dueAt }: { dueAt: string }) {
  const label = formatDueLabel(dueAt);
  const overdue = label.includes("overdue") || label === "yesterday";
  const soon = label === "today" || label === "tomorrow";
  const tone = overdue
    ? "text-red-600 dark:text-red-400"
    : soon
      ? "text-amber-600 dark:text-amber-400"
      : "text-zinc-500";
  return <span className={`text-xs ${tone}`}>{label}</span>;
}

function formatMoveDate(moveDate: string): string {
  const [y, m, d] = moveDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatCountdown(moveDate: string): string {
  const [y, m, d] = moveDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 0) return `in ${days} days`;
  return `${-days} days ago`;
}
