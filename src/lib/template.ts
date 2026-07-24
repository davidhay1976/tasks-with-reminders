import type { TaskCategory, TaskSide } from "./types";

// A single item that will be turned into a `tasks` row on move creation.
// offset_days: how many days BEFORE the move date; negative = after the move.
export interface TemplateItem {
  title: string;
  side: TaskSide;
  room: string | null;
  category: TaskCategory;
  offset_days: number;
}

export const USA_ROOMS = [
  "Living room",
  "Dining room",
  "Kitchen",
  "Master bedroom",
  "Master bedroom shower",
  "Laundry room",
  "Office",
  "Spare room",
  "Upper living room",
  "Girls room",
  "Girls room shower",
  "Guest room",
];

export const ISRAEL_ROOMS = [
  "Office",
  "Shelter",
  "Basement",
  "Living room",
  "Dining room",
  "Kitchen",
  "Laundry room",
  "Master bedroom",
  "Master bedroom bath",
  "Closet room",
  "Shelly",
  "Emily",
  "Leah",
  "Spare space",
  "Girls bath",
  "Garden",
  "Parking",
];

// ---------- USA: general (logistics, admin, etc.) ----------
// Note: `side: 'both'` items are shown in the USA pane per current design.

const USA_GENERAL: TemplateItem[] = [
  // 8+ weeks out — big-ticket decisions
  { title: "Get 3 quotes from international moving companies", side: "both", room: null, category: "logistics", offset_days: 63 },
  { title: "Decide what ships, what stores, what goes on the plane", side: "both", room: null, category: "logistics", offset_days: 63 },
  { title: "Set a moving budget (movers, flights, shipping, deposits)", side: "both", room: null, category: "admin", offset_days: 63 },
  { title: "Book international movers / shipping container", side: "both", room: null, category: "logistics", offset_days: 56 },
  { title: "Book flights to Israel", side: "both", room: null, category: "logistics", offset_days: 56 },
  { title: "Give notice to landlord (typically 60 days)", side: "origin", room: null, category: "admin", offset_days: 56 },

  // ~6 weeks out
  { title: "Order packing supplies — boxes, tape, bubble wrap, labels", side: "both", room: null, category: "packing", offset_days: 42 },
  { title: "Handle pet paperwork — rabies, USDA cert, import permit", side: "both", room: null, category: "admin", offset_days: 42 },
  { title: "Get certified copies: birth, marriage, diplomas, kids' school records", side: "origin", room: null, category: "admin", offset_days: 42 },
  { title: "Refill prescriptions; request medical + dental records", side: "origin", room: null, category: "admin", offset_days: 42 },

  // ~4 weeks out
  { title: "Decide car: sell, donate, or ship", side: "origin", room: null, category: "logistics", offset_days: 28 },
  { title: "List / sell furniture not shipping", side: "origin", room: null, category: "logistics", offset_days: 28 },
  { title: "Arrange time off work for moving week", side: "both", room: null, category: "logistics", offset_days: 28 },
  { title: "Book a cleaner for the old place", side: "origin", room: null, category: "logistics", offset_days: 28 },

  // ~3 weeks out
  { title: "USPS mail forwarding to a trusted US address", side: "origin", room: null, category: "admin", offset_days: 21 },
  { title: "Update address with bank, credit cards, brokerage", side: "origin", room: null, category: "admin", offset_days: 21 },
  { title: "Notify IRS of address change (form 8822)", side: "origin", room: null, category: "admin", offset_days: 21 },
  { title: "Cancel or transfer subscriptions (Netflix, gym, etc.)", side: "origin", room: null, category: "admin", offset_days: 21 },
  { title: "Plan final US tax return / talk to expat CPA", side: "origin", room: null, category: "admin", offset_days: 21 },

  // ~2 weeks out
  { title: "Schedule utility shut-off — electric, gas, water", side: "origin", room: null, category: "utilities", offset_days: 14 },
  { title: "Schedule internet cancellation for day after move", side: "origin", room: null, category: "utilities", offset_days: 14 },
  { title: "Confirm renter's insurance end date", side: "origin", room: null, category: "admin", offset_days: 14 },

  // ~1 week out
  { title: "Confirm booking with movers; give exact address + contact", side: "both", room: null, category: "logistics", offset_days: 7 },
  { title: 'Pack a "first night" box — meds, chargers, docs, change of clothes', side: "both", room: null, category: "packing", offset_days: 5 },
  { title: "Prepare carry-on with all critical documents + valuables", side: "both", room: null, category: "packing", offset_days: 5 },

  // Moving day
  { title: "Final walkthrough with landlord; photograph the empty apartment", side: "origin", room: null, category: "logistics", offset_days: 0 },
  { title: "Hand off keys; get receipt / confirmation", side: "origin", room: null, category: "logistics", offset_days: 0 },
  { title: "Record final meter readings for utilities", side: "origin", room: null, category: "utilities", offset_days: 0 },

  // After move
  { title: "Follow up on old apartment security deposit refund", side: "origin", room: null, category: "post_move", offset_days: -21 },
  { title: "File final US tax return by deadline", side: "origin", room: null, category: "post_move", offset_days: -90 },
];

// ---------- Israel: general (destination admin) ----------

const ISRAEL_GENERAL: TemplateItem[] = [
  { title: "Prepare aliyah / visa paperwork (if not already done)", side: "destination", room: null, category: "admin", offset_days: 56 },
  { title: "Research schools; start enrollment for each child", side: "destination", room: null, category: "admin", offset_days: 42 },
  { title: "Confirm landlord in Israel; sign lease (חוזה שכירות)", side: "destination", room: null, category: "admin", offset_days: 28 },
  { title: "Get temporary Israeli SIM card ordered / on hand for arrival", side: "destination", room: null, category: "admin", offset_days: 14 },

  // Right after landing
  { title: "Get / update Teudat Zehut (תעודת זהות) at Misrad Hapnim", side: "destination", room: null, category: "admin", offset_days: -3 },
  { title: "Open Israeli bank account (Leumi / Hapoalim / Discount)", side: "destination", room: null, category: "admin", offset_days: -5 },
  { title: "Register at Iryah (עירייה / municipality)", side: "destination", room: null, category: "admin", offset_days: -7 },
  { title: "Sign up with Kupat Cholim (Clalit / Maccabi / Meuhedet / Leumit)", side: "destination", room: null, category: "admin", offset_days: -7 },
  { title: "Enroll each child in their school (bring records + Teudat Zehut)", side: "destination", room: null, category: "admin", offset_days: -7 },
  { title: "Apartment protocol / מפרט with landlord — photograph everything", side: "destination", room: null, category: "logistics", offset_days: -1 },
  { title: "Set up electricity account with Chevrat Chashmal", side: "destination", room: null, category: "utilities", offset_days: -3 },
  { title: "Set up water account with Mei Avivim (or local water co.)", side: "destination", room: null, category: "utilities", offset_days: -3 },
  { title: "Set up gas (Amisragaz / Pazgas / Supergas)", side: "destination", room: null, category: "utilities", offset_days: -3 },
  { title: "Set up arnona (ארנונה) with the Iryah — apply for olim discount", side: "destination", room: null, category: "admin", offset_days: -7 },
  { title: "Set up internet (Bezeq / Hot / Partner)", side: "destination", room: null, category: "utilities", offset_days: -5 },
  { title: "Convert US driver's license → Israeli", side: "destination", room: null, category: "post_move", offset_days: -30 },
  { title: "Register car (if imported) with Misrad HaRishui", side: "destination", room: null, category: "post_move", offset_days: -30 },
  { title: "Meet a family lawyer / accountant re Israeli taxes", side: "destination", room: null, category: "post_move", offset_days: -30 },
];

// ---------- Per-room packing patterns (USA side) ----------
// Rooms fall into rough categories; each category has a template of tasks
// keyed by offset. Add specific overrides for individual rooms.

type RoomKind =
  | "living" // living rooms, dining, guest, upper
  | "bedroom" // sleeping rooms
  | "kids" // kids' rooms (may overlap with bedroom)
  | "bathroom" // showers, baths
  | "kitchen"
  | "office"
  | "laundry"
  | "storage" // basement, spare, parking, garden, closet
  | "shelter";

function classifyUsaRoom(room: string): RoomKind {
  const r = room.toLowerCase();
  if (r.includes("kitchen")) return "kitchen";
  if (r.includes("office")) return "office";
  if (r.includes("laundry")) return "laundry";
  if (r.includes("shower") || r.includes("bath")) return "bathroom";
  if (r === "girls room" || r.includes("kids")) return "kids";
  if (r.includes("bedroom") || r === "master bedroom") return "bedroom";
  if (r.includes("spare") || r === "guest room") return "storage";
  return "living";
}

function classifyIsraelRoom(room: string): RoomKind {
  const r = room.toLowerCase();
  if (r === "kitchen") return "kitchen";
  if (r === "office") return "office";
  if (r === "laundry room") return "laundry";
  if (r === "shelter") return "shelter";
  if (r === "master bedroom bath" || r === "girls bath") return "bathroom";
  if (r === "master bedroom") return "bedroom";
  if (["shelly", "emily", "leah"].includes(r)) return "kids";
  if (["basement", "spare space", "parking", "garden", "closet room"].includes(r))
    return "storage";
  return "living";
}

function packTasksForRoom(room: string): Omit<TemplateItem, "side">[] {
  const kind = classifyUsaRoom(room);
  switch (kind) {
    case "kitchen":
      return [
        { title: `${room}: sort pantry — toss expired, donate excess`, room, category: "packing", offset_days: 28 },
        { title: `${room}: sort cookware — keep, donate, toss`, room, category: "packing", offset_days: 21 },
        { title: `${room}: box up rarely-used appliances`, room, category: "packing", offset_days: 21 },
        { title: `${room}: use up perishables; run down the freezer`, room, category: "packing", offset_days: 7 },
        { title: `${room}: defrost freezer 24h before movers`, room, category: "packing", offset_days: 1 },
        { title: `${room}: clean fridge and oven`, room, category: "packing", offset_days: 1 },
        { title: `${room}: pack remaining daily-use items`, room, category: "packing", offset_days: 0 },
      ];
    case "bedroom":
    case "kids":
      return [
        { title: `${room}: sort clothes — keep, donate, toss`, room, category: "packing", offset_days: 28 },
        { title: `${room}: pack off-season clothes + rarely worn items`, room, category: "packing", offset_days: 21 },
        { title: `${room}: pack books, decor, toys`, room, category: "packing", offset_days: 14 },
        { title: `${room}: pack remaining clothes; strip bed; pack linens`, room, category: "packing", offset_days: 2 },
      ];
    case "bathroom":
      return [
        { title: `${room}: toss expired toiletries and meds`, room, category: "packing", offset_days: 14 },
        { title: `${room}: pack extra toiletries; keep essentials out`, room, category: "packing", offset_days: 7 },
        { title: `${room}: pack essentials into "first night" box`, room, category: "packing", offset_days: 2 },
      ];
    case "kitchen":
      // (handled above)
      return [];
    case "office":
      return [
        { title: `${room}: back up all computers and important files`, room, category: "packing", offset_days: 28 },
        { title: `${room}: sort and shred sensitive papers`, room, category: "packing", offset_days: 21 },
        { title: `${room}: pack books and reference materials`, room, category: "packing", offset_days: 14 },
        { title: `${room}: pack electronics; label all cables`, room, category: "packing", offset_days: 5 },
      ];
    case "laundry":
      return [
        { title: `${room}: finish all laundry; empty machines`, room, category: "packing", offset_days: 3 },
        { title: `${room}: clean lint traps and drums`, room, category: "packing", offset_days: 2 },
        { title: `${room}: prep washer/dryer for movers (drain, disconnect)`, room, category: "packing", offset_days: 1 },
      ];
    case "storage":
      return [
        { title: `${room}: sort — decide what ships vs sells vs tosses`, room, category: "packing", offset_days: 28 },
        { title: `${room}: check for hazardous items movers won't take`, room, category: "packing", offset_days: 14 },
        { title: `${room}: pack remaining keepers`, room, category: "packing", offset_days: 7 },
      ];
    case "living":
    default:
      return [
        { title: `${room}: sort decor and photos — pack, donate, toss`, room, category: "packing", offset_days: 28 },
        { title: `${room}: pack books, art, non-essential decor`, room, category: "packing", offset_days: 14 },
        { title: `${room}: wrap and pack fragile items carefully`, room, category: "packing", offset_days: 5 },
        { title: `${room}: pack electronics; label cables`, room, category: "packing", offset_days: 3 },
      ];
  }
}

function setupTasksForRoom(room: string): Omit<TemplateItem, "side">[] {
  const kind = classifyIsraelRoom(room);
  switch (kind) {
    case "kitchen":
      return [
        { title: `${room}: check what appliances the apartment includes`, room, category: "logistics", offset_days: -1 },
        { title: `${room}: buy any missing essentials (kettle, toaster, etc.)`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: stock basic pantry — oil, salt, spices, rice, pasta`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: unpack cookware and dishes`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: set up water filter / bar mayim`, room, category: "logistics", offset_days: -7 },
      ];
    case "bedroom":
    case "kids":
      return [
        { title: `${room}: measure space; plan furniture layout`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: buy bed frame + mattress (Israeli sizes)`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: buy bedding — sheets + duvet in Israeli sizes`, room, category: "logistics", offset_days: -7 },
        { title: `${room}: buy curtains / blinds (or check landlord's)`, room, category: "logistics", offset_days: -7 },
        { title: `${room}: unpack clothes and personal items`, room, category: "logistics", offset_days: -10 },
      ];
    case "bathroom":
      return [
        { title: `${room}: buy toiletries, cleaning supplies, shower curtain`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: buy hand + bath towels`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: unpack medications and personal items`, room, category: "logistics", offset_days: -7 },
      ];
    case "office":
      return [
        { title: `${room}: measure and plan layout for desk + storage`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: buy any missing office furniture`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: set up internet + wifi (once installed)`, room, category: "utilities", offset_days: -7 },
        { title: `${room}: unpack computer, monitor, cables`, room, category: "logistics", offset_days: -10 },
      ];
    case "laundry":
      return [
        { title: `${room}: check whether washer/dryer are included`, room, category: "logistics", offset_days: -1 },
        { title: `${room}: buy washer + dryer if not included`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: buy detergent + supplies`, room, category: "logistics", offset_days: -5 },
      ];
    case "shelter":
      return [
        { title: `${room}: check emergency supplies (water, food, radio, first aid)`, room, category: "logistics", offset_days: -14 },
        { title: `${room}: check door and window seals are intact`, room, category: "logistics", offset_days: -14 },
        { title: `${room}: keep clear pathway; don't overfill with storage`, room, category: "logistics", offset_days: -14 },
      ];
    case "storage":
      return [
        { title: `${room}: plan what goes here vs. living areas`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: unpack and organize`, room, category: "logistics", offset_days: -14 },
      ];
    case "living":
    default:
      return [
        { title: `${room}: measure space; plan furniture layout`, room, category: "logistics", offset_days: -3 },
        { title: `${room}: buy essential furniture (sofa / table / chairs)`, room, category: "logistics", offset_days: -5 },
        { title: `${room}: buy lighting and curtains`, room, category: "logistics", offset_days: -7 },
        { title: `${room}: unpack and arrange`, room, category: "logistics", offset_days: -10 },
      ];
  }
}

// ---------- Assemble the two full templates ----------

export const USA_TEMPLATE: TemplateItem[] = [
  ...USA_GENERAL,
  ...USA_ROOMS.flatMap((room) =>
    packTasksForRoom(room).map((t) => ({ ...t, side: "origin" as TaskSide })),
  ),
];

export const ISRAEL_TEMPLATE: TemplateItem[] = [
  ...ISRAEL_GENERAL,
  ...ISRAEL_ROOMS.flatMap((room) =>
    setupTasksForRoom(room).map((t) => ({
      ...t,
      side: "destination" as TaskSide,
    })),
  ),
];

// ---------- Helpers ----------

export function computeDueAt(moveDate: string, offsetDays: number): string {
  const [y, m, d] = moveDate.split("-").map(Number);
  const due = new Date(y, m - 1, d - offsetDays, 9, 0, 0, 0);
  return due.toISOString();
}

export function formatDueLabel(dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const dayDiff = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (dayDiff < 0) return dayDiff === -1 ? "yesterday" : `${-dayDiff}d overdue`;
  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "tomorrow";
  if (dayDiff <= 7) return `in ${dayDiff}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
