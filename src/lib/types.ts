export type TaskCategory =
  | "packing"
  | "admin"
  | "utilities"
  | "logistics"
  | "post_move"
  | "other";

export type TaskStatus = "todo" | "done";

export interface Task {
  id: string;
  move_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  category: TaskCategory;
  status: TaskStatus;
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
  created_at: string;
}
