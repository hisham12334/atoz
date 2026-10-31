import { db, fail, json, member, today } from "@/lib/rental";
export async function GET() {
  const user = await member(); if (!user) return fail("Sign in required", 401);
  const d = db();
  const [products, variants, parties, rentals, items, returns, movements, members] = await Promise.all([
    d.prepare("SELECT * FROM products ORDER BY name").all(),
    d.prepare("SELECT * FROM variants ORDER BY label").all(),
    d.prepare("SELECT * FROM parties ORDER BY name").all(),
    d.prepare("SELECT * FROM rentals ORDER BY created_at DESC").all(),
    d.prepare("SELECT * FROM rental_items").all(),
    d.prepare("SELECT * FROM return_events ORDER BY created_at DESC").all(),
    d.prepare("SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 100").all(),
    user.role === "admin" ? d.prepare("SELECT user_id,email,name,role FROM members ORDER BY created_at").all() : Promise.resolve({ results: [] }),
  ]);
  return json({ user, today: today(), products: products.results, variants: variants.results, parties: parties.results, rentals: rentals.results, items: items.results, returns: returns.results, movements: movements.results, members: members.results });
}
