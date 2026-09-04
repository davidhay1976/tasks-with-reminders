"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getMoveSupabase } from "@/lib/supabase";
import type { Task, TaskSide } from "@/lib/types";
import { COMMON_CATEGORIES } from "@/lib/types";
import {
  USA_ROOMS,
  ISRAEL_ROOMS,
  formatDueLabel,
} from "@/lib/template";
import { rememberMove } from "@/lib/recent";
import { QRCodeSVG } from "qrcode.react";
import { InstallHint } from "@/app/install-hint";
import { BagsView } from "./bags-view";
import { downloadArchive, type ArchiveProgress } from "@/lib/archive";

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
  const [editing, setEditing] = useState<Task | null>(null);
  const [sharing, setSharing] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [view, setView] = useState<"list" | "calendar" | "bags">("list");

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
    rememberMove({
      token,
      move_date: moveRes.data.move_date,
      origin_country: moveRes.data.origin_country,
      destination_country: moveRes.data.destination_country,
    });
  }, [supabase, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(side: TaskSide, title: string, room: string | null) {
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
      room,
      starts_at: null,
      duration_minutes: null,
      contact: null,
      reminder_offsets_minutes: [],
      sort_order: 0,
      created_at: now,
      updated_at: now,
    };
    setTasks((prev) => [...prev, optimistic]);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({ move_id: move.id, title, side, room })
      .select()
      .single<Task>();

    if (error || !data) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setError(error?.message ?? "Insert blocked — check that this link is valid.");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
  }

  async function saveMoveDate(newDate: string) {
    if (!move) return;
    const previous = move;
    setMove({ ...move, move_date: newDate });
    setError(null);

    const { data, error } = await supabase
      .from("moves")
      .update({ move_date: newDate })
      .eq("id", move.id)
      .select()
      .single<MoveHeader>();

    if (error || !data) {
      setMove(previous);
      setError(error?.message ?? "Couldn't update the move date.");
      return;
    }
    setMove(data);
    setEditingDate(false);
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

  async function saveEdit(patch: {
    id: string;
    title: string;
    notes: string | null;
    side: TaskSide;
    room: string | null;
    category: string;
    due_at: string | null;
    starts_at: string | null;
    duration_minutes: number | null;
    contact: string | null;
  }) {
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === patch.id ? { ...t, ...patch } : t)),
    );
    setEditing(null);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .update({
        title: patch.title,
        notes: patch.notes,
        side: patch.side,
        room: patch.room,
        category: patch.category,
        due_at: patch.due_at,
        starts_at: patch.starts_at,
        duration_minutes: patch.duration_minutes,
        contact: patch.contact,
      })
      .eq("id", patch.id)
      .select()
      .single<Task>();

    if (error || !data) {
      setTasks(previous);
      setError(error?.message ?? "Save blocked — RLS didn't see your token.");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
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

  const knownCategories = useMemo(() => {
    const set = new Set<string>(COMMON_CATEGORIES);
    for (const t of tasks) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [tasks]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                disabled={!move}
                className="underline decoration-dotted underline-offset-4 hover:text-zinc-700 disabled:no-underline dark:hover:text-zinc-300"
                title="Change move date"
              >
                {move?.move_date ? (
                  <>Moving {formatMoveDate(move.move_date)}</>
                ) : (
                  "Set move date"
                )}
              </button>
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {move ? `${move.origin_country} → ${move.destination_country}` : ""}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              {move?.move_date && (
                <p className="text-sm text-zinc-500">
                  {formatCountdown(move.move_date)}
                </p>
              )}
              <div className="flex rounded-full border border-zinc-300 p-0.5 text-xs font-medium dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={
                    view === "list"
                      ? "rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                      : "px-3 py-1 text-zinc-600 dark:text-zinc-400"
                  }
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView("calendar")}
                  className={
                    view === "calendar"
                      ? "rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                      : "px-3 py-1 text-zinc-600 dark:text-zinc-400"
                  }
                >
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setView("bags")}
                  className={
                    view === "bags"
                      ? "rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                      : "px-3 py-1 text-zinc-600 dark:text-zinc-400"
                  }
                >
                  Bags
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Share
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {todoCount} to do · {doneCount} done
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <InstallHint />

        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {view === "calendar" ? (
          <CalendarView tasks={tasks} onEdit={setEditing} />
        ) : view === "bags" ? (
          move ? <BagsView moveId={move.id} supabase={supabase} /> : null
        ) : (
          <ListView
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            originCountry={move?.origin_country}
            destinationCountry={move?.destination_country}
            originTasks={originTasks}
            destinationTasks={destinationTasks}
          />
        )}
      </main>

      {editing && (
        <EditTaskModal
          task={editing}
          knownCategories={knownCategories}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {sharing && move && (
        <ShareModal
          moveId={move.id}
          supabase={supabase}
          onClose={() => setSharing(false)}
        />
      )}

      {editingDate && move && (
        <EditMoveDateModal
          currentDate={move.move_date}
          onCancel={() => setEditingDate(false)}
          onSave={saveMoveDate}
        />
      )}
    </div>
  );

  function ListView({
    activeTab,
    setActiveTab,
    originCountry,
    destinationCountry,
    originTasks,
    destinationTasks,
  }: {
    activeTab: "origin" | "destination";
    setActiveTab: (t: "origin" | "destination") => void;
    originCountry: string | undefined;
    destinationCountry: string | undefined;
    originTasks: Task[];
    destinationTasks: Task[];
  }) {
    return (
      <>
        <div className="mb-4 flex gap-2 md:hidden">
          <TabButton
            active={activeTab === "origin"}
            label={originCountry ?? "USA"}
            flag="🇺🇸"
            count={originTasks.filter((t) => t.status === "todo").length}
            onClick={() => setActiveTab("origin")}
          />
          <TabButton
            active={activeTab === "destination"}
            label={destinationCountry ?? "Israel"}
            flag="🇮🇱"
            count={destinationTasks.filter((t) => t.status === "todo").length}
            onClick={() => setActiveTab("destination")}
          />
        </div>

        <div className="md:grid md:grid-cols-2 md:gap-6">
          <div
            className={
              (activeTab === "origin" ? "" : "hidden md:block ") +
              "rounded-lg bg-red-50/60 p-3 dark:bg-red-950/20"
            }
          >
            <CountryPane
              label={originCountry ?? "USA"}
              flag="🇺🇸"
              side="origin"
              tasks={originTasks}
              rooms={USA_ROOMS}
              loading={loading}
              expanded={expanded}
              onToggleRoom={(room) => toggleRoom(`origin:${room}`)}
              expandedKey={(room) => `origin:${room}`}
              onAdd={(title, room) => addTask("origin", title, room)}
              onToggle={toggle}
              onDelete={remove}
              onEdit={setEditing}
            />
          </div>
          <div
            className={
              (activeTab === "destination" ? "" : "hidden md:block ") +
              "rounded-lg bg-sky-50/60 p-3 dark:bg-sky-950/20"
            }
          >
            <CountryPane
              label={destinationCountry ?? "Israel"}
              flag="🇮🇱"
              side="destination"
              tasks={destinationTasks}
              rooms={ISRAEL_ROOMS}
              loading={loading}
              expanded={expanded}
              onToggleRoom={(room) => toggleRoom(`destination:${room}`)}
              expandedKey={(room) => `destination:${room}`}
              onAdd={(title, room) => addTask("destination", title, room)}
              onToggle={toggle}
              onDelete={remove}
              onEdit={setEditing}
            />
          </div>
        </div>
      </>
    );
  }
}

function RoomAddInput({
  room,
  onAdd,
}: {
  room: string;
  onAdd: (title: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    setValue("");
    await onAdd(title);
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`+ Add to ${room}…`}
        className="w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 outline-none dark:text-zinc-200"
      />
    </form>
  );
}

function EditMoveDateModal({
  currentDate,
  onCancel,
  onSave,
}: {
  currentDate: string | null;
  onCancel: () => void;
  onSave: (newDate: string) => Promise<void> | void;
}) {
  const [date, setDate] = useState(currentDate ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    onSave(date);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-t-2xl bg-white p-5 shadow-xl dark:bg-zinc-950 md:rounded-2xl"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Move date
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />

        <p className="text-xs text-zinc-500">
          Existing task due dates won&rsquo;t shift automatically. Edit tasks
          individually if you want to move them.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!date || date === currentDate}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function ShareModal({
  moveId,
  supabase,
  onClose,
}: {
  moveId: string;
  supabase: ReturnType<typeof getMoveSupabase>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress | null>(
    null,
  );
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function archive() {
    setArchiving(true);
    setArchiveError(null);
    setArchiveProgress({ step: "Starting…", current: 0, total: 1 });
    try {
      await downloadArchive(supabase, moveId, setArchiveProgress);
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Archive failed.");
    } finally {
      setArchiving(false);
      setArchiveProgress(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: "Our move checklist", url });
    } catch {
      // User cancelled, or share not supported — fall back to copy.
      copy();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-xl dark:bg-zinc-950 md:rounded-2xl"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Share this move
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Anyone with this link can view and edit tasks. Send it to your
          partner, or scan the QR code from another device.
        </p>

        <div className="flex justify-center rounded-lg bg-white p-4">
          {url && (
            <QRCodeSVG value={url} size={192} level="M" bgColor="#ffffff" fgColor="#000000" />
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700 break-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {url || "…"}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="flex-1 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Share…
            </button>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="mb-2 text-xs text-zinc-500">
            Download a self-contained archive (HTML + photos + JSON) you can
            open offline forever, even if the server goes away.
          </p>
          <button
            type="button"
            onClick={archive}
            disabled={archiving}
            className="w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {archiving
              ? archiveProgress
                ? `${archiveProgress.step}${
                    archiveProgress.total > 1
                      ? ` (${archiveProgress.current}/${archiveProgress.total})`
                      : ""
                  }`
                : "Preparing…"
              : "Download archive"}
          </button>
          {archiveError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {archiveError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function TabButton({
  active,
  label,
  flag,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  flag: string;
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
      <span className="mr-1">{flag}</span>
      {label} <span className="opacity-60">· {count}</span>
    </button>
  );
}

function CountryPane({
  label,
  flag,
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
  onEdit,
}: {
  label: string;
  flag: string;
  side: TaskSide;
  tasks: Task[];
  rooms: string[];
  loading: boolean;
  expanded: Set<string>;
  onToggleRoom: (room: string) => void;
  expandedKey: (room: string) => string;
  onAdd: (title: string, room: string | null) => Promise<void> | void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [newSection, setNewSection] = useState("");

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

  // Order: GENERAL first, then predefined rooms in order, then any extras
  // (rooms found in tasks OR added locally via "+ New section") alphabetically.
  const orderedRooms = useMemo(() => {
    const inTasks = new Set(byRoom.keys());
    const ordered: string[] = [GENERAL];
    for (const room of rooms) {
      if (inTasks.has(room)) ordered.push(room);
    }
    const combined = new Set<string>();
    for (const r of inTasks) if (r !== GENERAL && !rooms.includes(r)) combined.add(r);
    for (const r of customRooms) if (r !== GENERAL && !rooms.includes(r)) combined.add(r);
    const extras = Array.from(combined).sort();
    return [...ordered, ...extras];
  }, [byRoom, rooms, customRooms]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    await onAdd(title, null);
  }

  function handleNewSection(e: React.FormEvent) {
    e.preventDefault();
    const name = newSection.trim();
    if (!name) return;
    setCustomRooms((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewSection("");
    // Auto-expand the new section so the "+ Add to X" input is visible.
    if (!expanded.has(expandedKey(name))) onToggleRoom(name);
  }

  return (
    <section aria-label={label}>
      <div className="mb-3 hidden items-baseline justify-between md:flex">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="mr-1">{flag}</span>
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
                  <>
                    <ul className="border-t border-zinc-200 dark:border-zinc-800">
                      {items.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={onToggle}
                          onDelete={onDelete}
                          onEdit={onEdit}
                        />
                      ))}
                    </ul>
                    {room !== GENERAL && (
                      <RoomAddInput
                        room={room}
                        onAdd={(title) => onAdd(title, room)}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}

        <form onSubmit={handleNewSection} className="flex gap-2 pt-2">
          <input
            type="text"
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            placeholder="+ New section (e.g. need to buy)"
            className="flex-1 rounded-full border border-dashed border-zinc-300 bg-transparent px-4 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
          />
          <button
            type="submit"
            disabled={!newSection.trim()}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Add
          </button>
        </form>
      </div>
    </section>
  );
}

function CalendarView({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (t: Task) => void;
}) {
  const DAYS = 14;

  // Build 14 days starting from today, each with its scheduled tasks sorted by start.
  const days = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const result: { date: Date; items: Task[] }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push({ date: d, items: [] });
    }
    for (const t of tasks) {
      if (!t.starts_at) continue;
      const start_ = new Date(t.starts_at);
      const dayOffset = Math.round(
        (new Date(start_.getFullYear(), start_.getMonth(), start_.getDate()).getTime() -
          start.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (dayOffset >= 0 && dayOffset < DAYS) {
        result[dayOffset].items.push(t);
      }
    }
    for (const day of result) {
      day.items.sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
    }
    return result;
  }, [tasks]);

  const anyScheduled = days.some((d) => d.items.length > 0);

  return (
    <div className="space-y-4">
      {!anyScheduled && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No scheduled appointments yet. Open any task and set its Start time to
          see it here.
        </p>
      )}
      {days.map((day) => (
        <DayBlock key={day.date.toISOString()} date={day.date} items={day.items} onEdit={onEdit} />
      ))}
    </div>
  );
}

function DayBlock({
  date,
  items,
  onEdit,
}: {
  date: Date;
  items: Task[];
  onEdit: (t: Task) => void;
}) {
  const isToday = new Date().toDateString() === date.toDateString();
  const dayLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section
      className={
        "overflow-hidden rounded-lg border bg-white dark:bg-zinc-950 " +
        (isToday
          ? "border-indigo-400 dark:border-indigo-500"
          : "border-zinc-200 dark:border-zinc-800")
      }
    >
      <header className="flex items-baseline justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {isToday ? "Today · " : ""}
          {dayLabel}
        </h3>
        <p className="text-xs text-zinc-500">
          {items.length === 0
            ? "free"
            : items.length === 1
              ? "1 appointment"
              : `${items.length} appointments`}
        </p>
      </header>
      {items.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((task, i) => {
            const end = task.duration_minutes
              ? new Date(
                  new Date(task.starts_at!).getTime() + task.duration_minutes * 60_000,
                )
              : null;
            const conflictsWithNext =
              end && items[i + 1]
                ? new Date(items[i + 1].starts_at!).getTime() < end.getTime()
                : false;
            const conflictsWithPrev =
              i > 0 && items[i - 1].duration_minutes
                ? new Date(items[i - 1].starts_at!).getTime() +
                    items[i - 1].duration_minutes! * 60_000 >
                  new Date(task.starts_at!).getTime()
                : false;
            const inConflict = conflictsWithNext || conflictsWithPrev;
            const startLabel = new Date(task.starts_at!).toLocaleTimeString(
              undefined,
              { hour: "2-digit", minute: "2-digit" },
            );
            const endLabel = end
              ? end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
              : null;
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className={
                    "flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 " +
                    (inConflict ? "border-l-4 border-red-500" : "")
                  }
                >
                  <div className="min-w-[68px] text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {startLabel}
                    {endLabel && <div className="text-zinc-400">–{endLabel}</div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">
                      {task.status === "done" && (
                        <span
                          aria-label="done"
                          className="mr-1 text-emerald-600 dark:text-emerald-400"
                        >
                          ✓
                        </span>
                      )}
                      {task.title}
                    </p>
                    {task.contact && (
                      <p className="text-xs text-zinc-500">{task.contact}</p>
                    )}
                    {task.room && (
                      <p className="text-xs text-zinc-400">{task.room}</p>
                    )}
                    {inConflict && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Overlaps another appointment
                      </p>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="self-center text-xs text-zinc-400"
                  >
                    Edit ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800">
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggle(task)}
        className="h-5 w-5 accent-zinc-900 dark:accent-white"
      />
      <button
        type="button"
        onClick={() => onEdit(task)}
        className={
          task.status === "done"
            ? "flex-1 text-left text-sm text-zinc-400 line-through hover:text-zinc-500"
            : "flex-1 text-left text-sm text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
        }
      >
        {task.title}
      </button>
      {task.status === "todo" && (
        <>
          {task.starts_at ? (
            <span className="text-xs text-indigo-600 dark:text-indigo-400">
              {formatSchedule(task.starts_at, task.duration_minutes)}
            </span>
          ) : task.due_at ? (
            <DueBadge dueAt={task.due_at} />
          ) : null}
        </>
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

function EditTaskModal({
  task,
  knownCategories,
  onCancel,
  onSave,
}: {
  task: Task;
  knownCategories: string[];
  onCancel: () => void;
  onSave: (patch: {
    id: string;
    title: string;
    notes: string | null;
    side: TaskSide;
    room: string | null;
    category: string;
    due_at: string | null;
    starts_at: string | null;
    duration_minutes: number | null;
    contact: string | null;
  }) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [side, setSide] = useState<TaskSide>(task.side);
  const [room, setRoom] = useState<string>(task.room ?? "");
  const [category, setCategory] = useState<string>(task.category || "other");
  const [dueDate, setDueDate] = useState<string>(
    task.due_at ? task.due_at.slice(0, 10) : "",
  );
  const [startsAt, setStartsAt] = useState<string>(
    task.starts_at ? toLocalDateTimeInput(task.starts_at) : "",
  );
  const [duration, setDuration] = useState<string>(
    task.duration_minutes != null ? String(task.duration_minutes) : "",
  );
  const [contact, setContact] = useState<string>(task.contact ?? "");

  const roomOptions = useMemo(() => {
    if (side === "destination") return ISRAEL_ROOMS;
    if (side === "origin") return USA_ROOMS;
    return [...USA_ROOMS, ...ISRAEL_ROOMS.filter((r) => !USA_ROOMS.includes(r))];
  }, [side]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    let due_at: string | null = null;
    if (dueDate) {
      const [y, m, d] = dueDate.split("-").map(Number);
      due_at = new Date(y, m - 1, d, 9, 0, 0, 0).toISOString();
    }
    const starts_at = startsAt ? new Date(startsAt).toISOString() : null;
    const dur = duration.trim() ? Number.parseInt(duration, 10) : NaN;
    const duration_minutes = starts_at && Number.isFinite(dur) && dur > 0 ? dur : null;
    onSave({
      id: task.id,
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : null,
      side,
      room: room ? room : null,
      category: category.trim() || "other",
      due_at,
      starts_at,
      duration_minutes,
      contact: contact.trim() ? contact.trim() : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-xl dark:bg-zinc-950 md:rounded-2xl"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Edit task
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Country
            </span>
            <select
              value={side}
              onChange={(e) => {
                const nextSide = e.target.value as TaskSide;
                setSide(nextSide);
                // If the current room isn't valid for the new side, clear it.
                const validRooms =
                  nextSide === "destination"
                    ? ISRAEL_ROOMS
                    : nextSide === "origin"
                      ? USA_ROOMS
                      : [...USA_ROOMS, ...ISRAEL_ROOMS];
                if (room && !validRooms.includes(room)) setRoom("");
              }}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="origin">USA</option>
              <option value="destination">Israel</option>
              <option value="both">Both</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Room / section
            </span>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              list={`rooms-${task.id}`}
              placeholder="General"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <datalist id={`rooms-${task.id}`}>
              {roomOptions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Category
          </span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list={`categories-${task.id}`}
            placeholder="e.g. need to buy"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <datalist id={`categories-${task.id}`}>
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Due date
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Schedule (optional)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Starts at
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Duration (min)
              </span>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Contact
              </span>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Name / phone"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </form>
    </div>
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

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSchedule(startsAt: string, durationMinutes: number | null): string {
  const start = new Date(startsAt);
  const dayLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startLabel = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (!durationMinutes || durationMinutes <= 0) return `${dayLabel} · ${startLabel}`;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const endLabel = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${dayLabel} · ${startLabel}–${endLabel}`;
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
