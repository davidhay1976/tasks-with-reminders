"use client";

import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bag, BagPhoto, Move, Task } from "./types";
import { BAG_TYPE_LABEL } from "./types";

export interface ArchiveProgress {
  step: string;
  current: number;
  total: number;
}

export async function downloadArchive(
  supabase: SupabaseClient,
  moveId: string,
  onProgress?: (p: ArchiveProgress) => void,
): Promise<void> {
  const report = (step: string, current: number, total: number) =>
    onProgress?.({ step, current, total });

  report("Reading data…", 0, 1);
  const [moveRes, tasksRes, bagsRes] = await Promise.all([
    supabase.from("moves").select("*").eq("id", moveId).single<Move>(),
    supabase.from("tasks").select("*").eq("move_id", moveId).returns<Task[]>(),
    supabase.from("bags").select("*").eq("move_id", moveId).returns<Bag[]>(),
  ]);

  if (moveRes.error || !moveRes.data) {
    throw new Error(moveRes.error?.message ?? "Move not found.");
  }
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (bagsRes.error) throw new Error(bagsRes.error.message);

  const move = moveRes.data;
  const tasks = tasksRes.data ?? [];
  const bags = bagsRes.data ?? [];

  // Photos: RLS scopes bag_photos to this move's bags via share_token, but
  // filter explicitly in case the client is reused across moves later.
  const bagIds = bags.map((b) => b.id);
  const photosRes =
    bagIds.length === 0
      ? { data: [] as BagPhoto[], error: null }
      : await supabase
          .from("bag_photos")
          .select("*")
          .in("bag_id", bagIds)
          .returns<BagPhoto[]>();
  if (photosRes.error) throw new Error(photosRes.error.message);
  const photos = photosRes.data ?? [];

  const zip = new JSZip();

  const photoFolder = zip.folder("photos");
  const photoManifest: Record<string, string> = {}; // storage_path → zip path

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    report(`Downloading photos (${i + 1}/${photos.length})…`, i, photos.length);
    const { data, error } = await supabase.storage
      .from("bag-photos")
      .download(p.storage_path);
    if (error || !data) continue;
    const filename = p.storage_path.split("/").pop() ?? `${p.id}.bin`;
    const zipPath = `${p.bag_id}/${filename}`;
    photoFolder?.file(zipPath, data);
    photoManifest[p.storage_path] = `photos/${zipPath}`;
  }

  report("Building viewer…", photos.length, photos.length);

  const generatedAt = new Date().toISOString();
  const rawData = { move, tasks, bags, photos, generatedAt };
  zip.file("data.json", JSON.stringify(rawData, null, 2));
  zip.file(
    "index.html",
    renderViewerHtml({ move, tasks, bags, photos, photoManifest, generatedAt }),
  );

  report("Zipping…", photos.length, photos.length);
  const blob = await zip.generateAsync({ type: "blob" });

  const dateSlug = generatedAt.slice(0, 10);
  const filename = `move-archive-${dateSlug}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  report("Done", photos.length, photos.length);
}

// ---------- Viewer HTML ----------

function renderViewerHtml(args: {
  move: Move;
  tasks: Task[];
  bags: Bag[];
  photos: BagPhoto[];
  photoManifest: Record<string, string>;
  generatedAt: string;
}): string {
  const { move, tasks, bags, photos, photoManifest, generatedAt } = args;

  const photosByBag = new Map<string, BagPhoto[]>();
  for (const p of photos) {
    const arr = photosByBag.get(p.bag_id) ?? [];
    arr.push(p);
    photosByBag.set(p.bag_id, arr);
  }

  const tasksBySide = {
    origin: tasks.filter((t) => t.side === "origin" || t.side === "both"),
    destination: tasks.filter((t) => t.side === "destination"),
  };

  const scheduled = tasks
    .filter((t) => t.starts_at)
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));

  const bagsByType = new Map<Bag["type"], Bag[]>();
  for (const b of bags) {
    const arr = bagsByType.get(b.type) ?? [];
    arr.push(b);
    bagsByType.set(b.type, arr);
  }
  for (const arr of bagsByType.values())
    arr.sort((a, b) => a.sort_order - b.sort_order);

  const generatedLabel = new Date(generatedAt).toLocaleString();
  const routeLabel = `${escapeHtml(move.origin_country)} → ${escapeHtml(
    move.destination_country,
  )}`;
  const moveLabel = move.move_date
    ? new Date(move.move_date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "(no date set)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Move archive — ${escapeHtml(moveLabel)}</title>
  <style>
    :root {
      --bg: #fafafa;
      --panel: #ffffff;
      --text: #18181b;
      --muted: #71717a;
      --border: #e4e4e7;
      --accent: #4f46e5;
      --danger: #dc2626;
      --ok: #059669;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
      font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { background: var(--panel); border-bottom: 1px solid var(--border);
      padding: 16px 20px; }
    header h1 { margin: 0 0 4px; font-size: 18px; }
    header p { margin: 0; color: var(--muted); font-size: 13px; }
    nav { position: sticky; top: 0; background: var(--panel); border-bottom: 1px solid var(--border);
      padding: 8px 20px; display: flex; gap: 16px; z-index: 5; }
    nav a { color: var(--text); text-decoration: none; font-size: 14px; font-weight: 500; }
    nav a:hover { color: var(--accent); }
    main { max-width: 900px; margin: 0 auto; padding: 20px; }
    section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
      padding: 16px; margin-bottom: 20px; }
    section h2 { margin: 0 0 12px; font-size: 16px; }
    section h3 { margin: 16px 0 8px; font-size: 14px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.05em; }
    ul.tasks { list-style: none; padding: 0; margin: 0; }
    ul.tasks li { padding: 6px 0; border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: baseline; }
    ul.tasks li:last-child { border-bottom: 0; }
    .done { color: var(--muted); text-decoration: line-through; }
    .badge { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 999px;
      background: #f4f4f5; color: var(--muted); }
    .meta { font-size: 12px; color: var(--muted); }
    .cols { display: grid; grid-template-columns: 1fr; gap: 20px; }
    @media (min-width: 720px) { .cols { grid-template-columns: 1fr 1fr; } }
    .bag { border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin: 8px 0; }
    .bag h4 { margin: 0 0 4px; font-size: 14px; }
    .bag .contents { white-space: pre-wrap; margin: 6px 0 0; font-size: 14px; }
    .bag .weight { font-size: 13px; color: var(--muted); }
    .bag .weight.over { color: var(--danger); font-weight: 600; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 8px; }
    .photos a { display: block; aspect-ratio: 1; overflow: hidden; border-radius: 4px; background: #f4f4f5; }
    .photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .empty { color: var(--muted); font-style: italic; font-size: 13px; }
    footer { text-align: center; color: var(--muted); font-size: 12px; padding: 20px; }
  </style>
</head>
<body>
  <header>
    <h1>Move archive</h1>
    <p>${escapeHtml(moveLabel)} · ${routeLabel}</p>
    <p>Generated ${escapeHtml(generatedLabel)}</p>
  </header>
  <nav>
    <a href="#tasks">Tasks</a>
    <a href="#calendar">Calendar</a>
    <a href="#bags">Bags</a>
  </nav>
  <main>
    <section id="tasks">
      <h2>Tasks</h2>
      <div class="cols">
        <div>
          <h3>${escapeHtml(move.origin_country)}</h3>
          ${renderTaskList(tasksBySide.origin)}
        </div>
        <div>
          <h3>${escapeHtml(move.destination_country)}</h3>
          ${renderTaskList(tasksBySide.destination)}
        </div>
      </div>
    </section>

    <section id="calendar">
      <h2>Scheduled</h2>
      ${
        scheduled.length === 0
          ? '<p class="empty">No scheduled appointments.</p>'
          : `<ul class="tasks">${scheduled
              .map(
                (t) => `
        <li>
          <span class="meta">${escapeHtml(formatDateTime(t.starts_at!))}${
            t.duration_minutes ? ` · ${t.duration_minutes} min` : ""
          }</span>
          <span class="${t.status === "done" ? "done" : ""}">${escapeHtml(t.title)}</span>
          ${t.contact ? `<span class="meta">· ${escapeHtml(t.contact)}</span>` : ""}
        </li>`,
              )
              .join("")}</ul>`
      }
    </section>

    <section id="bags">
      <h2>Bags</h2>
      ${(["checked", "carry_on", "personal", "other"] as const)
        .map((type) => {
          const list = bagsByType.get(type) ?? [];
          if (list.length === 0) return "";
          const total = list.reduce((s, b) => s + (b.weight_kg ?? 0), 0);
          const hasWeight = list.some((b) => b.weight_kg != null);
          return `
        <h3>${escapeHtml(BAG_TYPE_LABEL[type])} (${list.length})${
          hasWeight ? ` · <span class="meta">${total.toFixed(1)}kg total</span>` : ""
        }</h3>
        ${list
          .map((bag, i) => renderBag(bag, i, photosByBag.get(bag.id) ?? [], photoManifest))
          .join("")}`;
        })
        .join("")}
    </section>
  </main>
  <footer>
    Static archive — data + photos included. Regenerate anytime from the app.
  </footer>
</body>
</html>`;
}

function renderTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return '<p class="empty">No tasks.</p>';
  const byRoom = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.room ?? "General";
    const arr = byRoom.get(key) ?? [];
    arr.push(t);
    byRoom.set(key, arr);
  }
  return Array.from(byRoom.entries())
    .map(
      ([room, items]) => `
    <div style="margin-bottom:12px">
      <div class="meta" style="margin-bottom:4px">${escapeHtml(room)}</div>
      <ul class="tasks">${items
        .map(
          (t) => `
        <li>
          <span class="${t.status === "done" ? "done" : ""}">${escapeHtml(t.title)}</span>
          ${t.due_at ? `<span class="meta">· due ${escapeHtml(formatDate(t.due_at))}</span>` : ""}
          ${t.category && t.category !== "other" ? `<span class="badge">${escapeHtml(t.category)}</span>` : ""}
        </li>`,
        )
        .join("")}</ul>
    </div>`,
    )
    .join("");
}

function renderBag(
  bag: Bag,
  indexInType: number,
  bagPhotos: BagPhoto[],
  photoManifest: Record<string, string>,
): string {
  const name = `${BAG_TYPE_LABEL[bag.type]} #${indexInType + 1}${
    bag.label ? ` · ${bag.label}` : ""
  }`;
  const weightLine =
    bag.weight_kg != null
      ? `<div class="weight">${bag.weight_kg.toFixed(1)}kg</div>`
      : "";
  const photoTiles = bagPhotos
    .map((p) => {
      const src = photoManifest[p.storage_path];
      if (!src) return "";
      return `<a href="${escapeAttr(src)}" target="_blank"><img src="${escapeAttr(src)}" alt="Bag photo" loading="lazy" /></a>`;
    })
    .join("");
  return `
    <div class="bag">
      <h4>${escapeHtml(name)}</h4>
      ${weightLine}
      ${bag.contents ? `<div class="contents">${escapeHtml(bag.contents)}</div>` : ""}
      ${photoTiles ? `<div class="photos">${photoTiles}</div>` : ""}
    </div>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
