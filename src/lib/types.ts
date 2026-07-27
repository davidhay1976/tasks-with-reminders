// Free-form after migration 0004. The common values below stay useful as
// suggestions and are what the template ships with, but any string works.
export type TaskCategory = string;

export const COMMON_CATEGORIES = [
  "packing",
  "admin",
  "utilities",
  "logistics",
  "post_move",
  "need to buy",
  "other",
] as const;

export type TaskStatus = "todo" | "done";

export type TaskSide = "origin" | "destination" | "both";

export interface Task {
  id: string;
  move_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  category: TaskCategory;
  status: TaskStatus;
  side: TaskSide;
  room: string | null;
  starts_at: string | null;
  duration_minutes: number | null;
  contact: string | null;
  reminder_offsets_minutes: number[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Move {
  id: string;
  share_token: string;
  move_date: string | null;
  current_address: string | null;
  new_address: string | null;
  origin_country: string;
  destination_country: string;
  created_at: string;
}

export type BagType = "checked" | "carry_on" | "personal" | "other";

export interface Bag {
  id: string;
  move_id: string;
  type: BagType;
  label: string | null;
  sort_order: number;
  contents: string | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface BagPhoto {
  id: string;
  bag_id: string;
  storage_path: string;
  created_at: string;
}

export const BAG_TYPE_LABEL: Record<BagType, string> = {
  checked: "Checked",
  carry_on: "Carry-on",
  personal: "Personal",
  other: "Other",
};

// Weight limits in kg. null = no limit. `pair` means the limit applies to
// consecutive pairs (positions 1+2, 3+4, …) rather than individual bags.
export const BAG_WEIGHT_LIMITS: Record<
  BagType,
  { individual: number | null; pair: number | null }
> = {
  checked: { individual: 23, pair: null },
  carry_on: { individual: null, pair: 12 },
  personal: { individual: null, pair: null },
  other: { individual: null, pair: null },
};
