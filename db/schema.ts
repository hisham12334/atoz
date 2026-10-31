import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  userId: text("user_id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(), role: text("role", { enum: ["admin", "staff"] }).notNull(), createdAt: text("created_at").notNull(),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(), name: text("name").notNull(), imageKey: text("image_key"), createdAt: text("created_at").notNull(),
});
export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(), productId: text("product_id").notNull().references(() => products.id), label: text("label").notNull(), color: text("color"), priceCents: integer("price_cents").notNull(), totalStock: integer("total_stock").notNull(), damagedStock: integer("damaged_stock").notNull().default(0), createdAt: text("created_at").notNull(),
}, (t) => [index("variants_product_idx").on(t.productId)]);
export const parties = sqliteTable("parties", {
  id: text("id").primaryKey(), name: text("name").notNull(), phone: text("phone"), email: text("email"), createdAt: text("created_at").notNull(),
});
export const rentals = sqliteTable("rentals", {
  id: text("id").primaryKey(), invoiceNo: text("invoice_no").notNull().unique(), partyId: text("party_id").notNull().references(() => parties.id), startDate: text("start_date").notNull(), dueDate: text("due_date").notNull(), days: integer("days").notNull(), notes: text("notes"), createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("rentals_dates_idx").on(t.startDate, t.dueDate)]);
export const rentalItems = sqliteTable("rental_items", {
  id: text("id").primaryKey(), rentalId: text("rental_id").notNull().references(() => rentals.id), variantId: text("variant_id").notNull().references(() => variants.id), quantity: integer("quantity").notNull(), priceCents: integer("price_cents").notNull(), usableReturned: integer("usable_returned").notNull().default(0), damagedReturned: integer("damaged_returned").notNull().default(0),
}, (t) => [index("rental_items_rental_idx").on(t.rentalId), index("rental_items_variant_idx").on(t.variantId)]);
export const returnEvents = sqliteTable("return_events", {
  id: text("id").primaryKey(), rentalItemId: text("rental_item_id").notNull().references(() => rentalItems.id), usable: integer("usable").notNull(), damaged: integer("damaged").notNull(), note: text("note"), actor: text("actor").notNull(), createdAt: text("created_at").notNull(),
});
export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(), variantId: text("variant_id").notNull().references(() => variants.id), kind: text("kind").notNull(), deltaTotal: integer("delta_total").notNull(), deltaDamaged: integer("delta_damaged").notNull(), note: text("note"), actor: text("actor").notNull(), createdAt: text("created_at").notNull(),
});
