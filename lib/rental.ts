import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const db = () => {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
};
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const iso = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const json = (value: unknown, status = 200) => Response.json(value, { status });
export const fail = (message: string, status = 400) => json({ error: message }, status);

export async function member() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const database = db();
  let found = await database.prepare("SELECT * FROM members WHERE user_id = ?").bind(user.userId).first<{ user_id: string; email: string; name: string; role: "admin" | "staff" }>();
  if (!found) {
    const count = await database.prepare("SELECT count(*) AS n FROM members").first<{ n: number }>();
    const invite = count?.n ? await database.prepare("SELECT name,role FROM member_invites WHERE email=? COLLATE NOCASE").bind(user.email).first<{name:string;role:"admin"|"staff"}>() : null;
    if (count?.n && !invite) return null;
    await database.prepare("INSERT OR IGNORE INTO members(user_id,email,name,role,created_at) VALUES(?,?,?,?,?)").bind(user.userId, user.email, invite?.name || user.displayName, invite?.role || "admin", iso()).run();
    if (invite) await database.prepare("DELETE FROM member_invites WHERE email=? COLLATE NOCASE").bind(user.email).run();
    found = await database.prepare("SELECT * FROM members WHERE user_id = ?").bind(user.userId).first();
  }
  return found;
}

export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}
export function daysBetween(start: string, due: string) {
  return Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000);
}
export function asText(value: unknown, max = 200) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function asInt(value: unknown) { return Number.isInteger(Number(value)) ? Number(value) : NaN; }

type Booking = { start_date: string; due_date: string; quantity: number; usable_returned: number; damaged_returned: number };
export function availability(total: number, damaged: number, bookings: Booking[], start: string, due: string, now = today()) {
  let min = total - damaged;
  for (let ms = Date.parse(start + "T00:00:00Z"); ms < Date.parse(due + "T00:00:00Z"); ms += 86400000) {
    const day = new Date(ms).toISOString().slice(0, 10);
    const occupied = bookings.reduce((sum, b) => {
      const outstanding = b.quantity - b.usable_returned - b.damaged_returned;
      const overlaps = b.start_date <= day && (day < b.due_date || (b.due_date <= now && outstanding > 0));
      return sum + (overlaps ? outstanding : 0);
    }, 0);
    min = Math.min(min, total - damaged - occupied);
  }
  return Math.max(0, min);
}
