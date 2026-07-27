"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BAG_TYPE_LABEL,
  BAG_WEIGHT_LIMITS,
  type Bag,
  type BagPhoto,
  type BagType,
} from "@/lib/types";

const SECTION_ORDER: BagType[] = ["checked", "carry_on", "personal", "other"];
const INITIAL_COUNTS: Partial<Record<BagType, number>> = {
  checked: 15,
  carry_on: 10,
  personal: 5,
};

interface Props {
  moveId: string;
  supabase: SupabaseClient;
}

export function BagsView({ moveId, supabase }: Props) {
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openBag, setOpenBag] = useState<Bag | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("bags")
        .select("*")
        .eq("move_id", moveId)
        .order("type", { ascending: true })
        .order("sort_order", { ascending: true })
        .returns<Bag[]>();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setBags(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, moveId]);

  // Auto-seed 15/10/5 on first load if the move has no bags yet.
  useEffect(() => {
    if (loading || seededRef.current || bags.length > 0) return;
    seededRef.current = true;
    (async () => {
      const rows: Array<Pick<Bag, "move_id" | "type" | "sort_order">> = [];
      for (const [type, count] of Object.entries(INITIAL_COUNTS) as Array<
        [BagType, number]
      >) {
        for (let i = 0; i < count; i++) {
          rows.push({ move_id: moveId, type, sort_order: i });
        }
      }
      const { data, error } = await supabase
        .from("bags")
        .insert(rows)
        .select()
        .returns<Bag[]>();
      if (error) {
        setError(error.message);
        return;
      }
      setBags(data ?? []);
    })();
  }, [loading, bags.length, supabase, moveId]);

  const bagsByType = useMemo(() => {
    const map = new Map<BagType, Bag[]>();
    for (const t of SECTION_ORDER) map.set(t, []);
    for (const b of bags) {
      const arr = map.get(b.type) ?? [];
      arr.push(b);
      map.set(b.type, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [bags]);

  async function addBag(type: BagType) {
    const existing = bagsByType.get(type) ?? [];
    const nextOrder =
      existing.length === 0 ? 0 : Math.max(...existing.map((b) => b.sort_order)) + 1;
    const { data, error } = await supabase
      .from("bags")
      .insert({ move_id: moveId, type, sort_order: nextOrder })
      .select()
      .single<Bag>();
    if (error || !data) {
      setError(error?.message ?? "Couldn't add bag.");
      return;
    }
    setBags((prev) => [...prev, data]);
    setOpenBag(data);
  }

  async function updateBag(id: string, patch: Partial<Bag>) {
    const previous = bags;
    setBags((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const { data, error } = await supabase
      .from("bags")
      .update(patch)
      .eq("id", id)
      .select()
      .single<Bag>();
    if (error || !data) {
      setBags(previous);
      setError(error?.message ?? "Couldn't save bag.");
      return null;
    }
    setBags((prev) => prev.map((b) => (b.id === id ? data : b)));
    return data;
  }

  async function deleteBag(id: string) {
    // Storage objects for photos of this bag aren't auto-cleaned; we sweep them
    // client-side before the DB cascade removes bag_photos rows.
    const { data: photos } = await supabase
      .from("bag_photos")
      .select("storage_path")
      .eq("bag_id", id)
      .returns<Pick<BagPhoto, "storage_path">[]>();
    const paths = (photos ?? []).map((p) => p.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("bag-photos").remove(paths);
    }
    const previous = bags;
    setBags((prev) => prev.filter((b) => b.id !== id));
    const { error } = await supabase.from("bags").delete().eq("id", id);
    if (error) {
      setBags(previous);
      setError(error.message);
    }
  }

  async function swap(a: Bag, b: Bag) {
    // Two-step swap to avoid unique-order conflicts (there's no unique constraint
    // today, but this keeps the pattern safe if we add one).
    const previous = bags;
    setBags((prev) =>
      prev.map((x) => {
        if (x.id === a.id) return { ...x, sort_order: b.sort_order };
        if (x.id === b.id) return { ...x, sort_order: a.sort_order };
        return x;
      }),
    );
    const [r1, r2] = await Promise.all([
      supabase.from("bags").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("bags").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      setBags(previous);
      setError(r1.error?.message ?? r2.error?.message ?? "Reorder failed.");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {loading && (
        <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>
      )}
      {!loading &&
        SECTION_ORDER.map((type) => (
          <BagSection
            key={type}
            type={type}
            bags={bagsByType.get(type) ?? []}
            onOpen={setOpenBag}
            onAdd={() => addBag(type)}
            onSwap={swap}
          />
        ))}

      {openBag && (
        <BagDetailModal
          bag={openBag}
          allBagsOfType={bagsByType.get(openBag.type) ?? []}
          supabase={supabase}
          moveId={moveId}
          onClose={() => setOpenBag(null)}
          onSave={async (patch) => {
            const saved = await updateBag(openBag.id, patch);
            if (saved) setOpenBag(saved);
          }}
          onDelete={async () => {
            await deleteBag(openBag.id);
            setOpenBag(null);
          }}
        />
      )}
    </div>
  );
}

function BagSection({
  type,
  bags,
  onOpen,
  onAdd,
  onSwap,
}: {
  type: BagType;
  bags: Bag[];
  onOpen: (bag: Bag) => void;
  onAdd: () => void;
  onSwap: (a: Bag, b: Bag) => void;
}) {
  const limits = BAG_WEIGHT_LIMITS[type];
  const totalWeight = bags.reduce((sum, b) => sum + (b.weight_kg ?? 0), 0);
  const hasAnyWeight = bags.some((b) => b.weight_kg != null);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {BAG_TYPE_LABEL[type]}
          <span className="ml-2 text-xs font-normal text-zinc-500">
            · {bags.length} {bags.length === 1 ? "bag" : "bags"}
            {hasAnyWeight && ` · ${formatKg(totalWeight)} total`}
          </span>
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          + Add bag
        </button>
      </header>

      {bags.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-zinc-500">
          No bags yet.
        </p>
      ) : type === "carry_on" ? (
        <PairedBagList bags={bags} onOpen={onOpen} onSwap={onSwap} />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {bags.map((bag, i) => (
            <BagRow
              key={bag.id}
              bag={bag}
              index={i}
              individualLimit={limits.individual}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PairedBagList({
  bags,
  onOpen,
  onSwap,
}: {
  bags: Bag[];
  onOpen: (bag: Bag) => void;
  onSwap: (a: Bag, b: Bag) => void;
}) {
  const pairLimit = BAG_WEIGHT_LIMITS.carry_on.pair!;
  const pairs: Bag[][] = [];
  for (let i = 0; i < bags.length; i += 2) {
    pairs.push(bags.slice(i, i + 2));
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {pairs.map((pair, pairIdx) => {
        const pairWeight = pair.reduce((s, b) => s + (b.weight_kg ?? 0), 0);
        const anyWeight = pair.some((b) => b.weight_kg != null);
        const over = anyWeight && pairWeight > pairLimit;
        const unpaired = pair.length === 1;
        return (
          <li key={pairIdx} className="px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                Pair {pairIdx + 1}
                {unpaired && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    · unpaired
                  </span>
                )}
              </span>
              {anyWeight && (
                <span
                  className={
                    over
                      ? "font-semibold text-red-600 dark:text-red-400"
                      : "text-zinc-500"
                  }
                >
                  {formatKg(pairWeight)} / {pairLimit}kg
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {pair.map((bag) => {
                const globalIdx = bags.findIndex((b) => b.id === bag.id);
                const canUp = globalIdx > 0;
                const canDown = globalIdx < bags.length - 1;
                return (
                  <PairedBagRow
                    key={bag.id}
                    bag={bag}
                    index={globalIdx}
                    canMoveUp={canUp}
                    canMoveDown={canDown}
                    onOpen={onOpen}
                    onMoveUp={() => onSwap(bag, bags[globalIdx - 1])}
                    onMoveDown={() => onSwap(bag, bags[globalIdx + 1])}
                  />
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function BagRow({
  bag,
  index,
  individualLimit,
  onOpen,
}: {
  bag: Bag;
  index: number;
  individualLimit: number | null;
  onOpen: (b: Bag) => void;
}) {
  const over =
    individualLimit != null && bag.weight_kg != null && bag.weight_kg > individualLimit;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(bag)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
          {bagDisplayName(bag, index)}
          {bag.contents && (
            <span className="ml-2 text-xs text-zinc-500">
              · {truncate(bag.contents, 40)}
            </span>
          )}
        </span>
        {bag.weight_kg != null && (
          <span
            className={
              over
                ? "text-sm font-semibold text-red-600 dark:text-red-400"
                : "text-sm text-zinc-500"
            }
          >
            {formatKg(bag.weight_kg)}
            {individualLimit != null && `/${individualLimit}kg`}
          </span>
        )}
        <span aria-hidden className="text-xs text-zinc-400">
          ›
        </span>
      </button>
    </li>
  );
}

function PairedBagRow({
  bag,
  index,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveUp,
  onMoveDown,
}: {
  bag: Bag;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: (b: Bag) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-zinc-50 dark:bg-zinc-900/50">
      <button
        type="button"
        onClick={() => onOpen(bag)}
        className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
          {bagDisplayName(bag, index)}
          {bag.contents && (
            <span className="ml-2 text-xs text-zinc-500">
              · {truncate(bag.contents, 30)}
            </span>
          )}
        </span>
        {bag.weight_kg != null && (
          <span className="text-sm text-zinc-500">{formatKg(bag.weight_kg)}</span>
        )}
      </button>
      <div className="flex px-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Move up"
          className="px-1.5 py-1 text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Move down"
          className="px-1.5 py-1 text-zinc-500 disabled:opacity-20 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ↓
        </button>
      </div>
    </li>
  );
}

function BagDetailModal({
  bag,
  allBagsOfType,
  supabase,
  moveId,
  onClose,
  onSave,
  onDelete,
}: {
  bag: Bag;
  allBagsOfType: Bag[];
  supabase: SupabaseClient;
  moveId: string;
  onClose: () => void;
  onSave: (patch: Partial<Bag>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [label, setLabel] = useState(bag.label ?? "");
  const [contents, setContents] = useState(bag.contents ?? "");
  const [weight, setWeight] = useState(
    bag.weight_kg != null ? String(bag.weight_kg) : "",
  );
  const [photos, setPhotos] = useState<BagPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("bag_photos")
        .select("*")
        .eq("bag_id", bag.id)
        .order("created_at", { ascending: true })
        .returns<BagPhoto[]>();
      if (error) {
        setError(error.message);
        return;
      }
      setPhotos(data ?? []);
    })();
  }, [supabase, bag.id]);

  const index = allBagsOfType.findIndex((b) => b.id === bag.id);
  const defaultName = bagDisplayName(bag, index);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = weight.trim() === "" ? null : Number(weight);
    if (w != null && !Number.isFinite(w)) {
      setError("Weight must be a number.");
      return;
    }
    onSave({
      label: label.trim() ? label.trim() : null,
      contents: contents.trim() ? contents.trim() : null,
      weight_kg: w,
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${moveId}/${bag.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("bag-photos")
          .upload(path, file, { contentType: file.type });
        if (up.error) {
          setError(up.error.message);
          continue;
        }
        const { data, error } = await supabase
          .from("bag_photos")
          .insert({ bag_id: bag.id, storage_path: path })
          .select()
          .single<BagPhoto>();
        if (error || !data) {
          await supabase.storage.from("bag-photos").remove([path]);
          setError(error?.message ?? "Photo saved but not linked.");
          continue;
        }
        setPhotos((prev) => [...prev, data]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deletePhoto(photo: BagPhoto) {
    const previous = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    const [{ error: dbErr }, { error: storageErr }] = await Promise.all([
      supabase.from("bag_photos").delete().eq("id", photo.id),
      supabase.storage.from("bag-photos").remove([photo.storage_path]),
    ]);
    if (dbErr || storageErr) {
      setPhotos(previous);
      setError(dbErr?.message ?? storageErr?.message ?? "Delete failed.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-xl dark:bg-zinc-950 md:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {defaultName}
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

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Custom label (optional)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Documents, Left behind"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Weight (kg)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 22.5"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Contents
          </span>
          <textarea
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            rows={4}
            placeholder="What's in this bag?"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Photos ({photos.length})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {uploading ? "Uploading…" : "+ Add photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  supabase={supabase}
                  onDelete={() => deletePhoto(p)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {confirmingDelete ? (
            <>
              <span className="mr-auto self-center text-xs text-red-600 dark:text-red-400">
                Delete this bag and its photos?
              </span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mr-auto text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Delete bag
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                Save
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function PhotoTile({
  photo,
  supabase,
  onDelete,
}: {
  photo: BagPhoto;
  supabase: SupabaseClient;
  onDelete: () => void;
}) {
  const url = supabase.storage.from("bag-photos").getPublicUrl(photo.storage_path)
    .data.publicUrl;
  return (
    <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Bag contents"
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete photo"
        className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
      >
        ×
      </button>
    </div>
  );
}

function bagDisplayName(bag: Bag, indexInType: number): string {
  const base = `${BAG_TYPE_LABEL[bag.type]} #${indexInType + 1}`;
  return bag.label ? `${base} · ${bag.label}` : base;
}

function formatKg(n: number): string {
  return `${n.toFixed(1)}kg`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
