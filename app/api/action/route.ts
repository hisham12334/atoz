import { availability, asInt, asText, daysBetween, db, fail, id, iso, json, member, today, validDate } from "@/lib/rental";

export async function POST(request: Request) {
  const user = await member(); if (!user) return fail("Sign in required", 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return fail("Invalid request"); }
  const d = db();
  try {
    if (body.type === "product") {
      const name = asText(body.name, 100);
      const rows = Array.isArray(body.variants) ? body.variants : [];
      if (!name || !rows.length || rows.length > 30) return fail("Add a product name and at least one variant");
      const productId = id(), now = iso();
      const statements = [d.prepare("INSERT INTO products(id,name,image_key,created_at) VALUES(?,?,?,?)").bind(productId,name,asText(body.imageKey,120) || null,now)];
      for (const row of rows) {
        const v = row as Record<string, unknown>;
        const label = asText(v.label, 80) || "Standard", price = asInt(v.priceCents), stock = asInt(v.totalStock);
        if (price < 0 || stock < 0 || !Number.isFinite(price) || !Number.isFinite(stock)) return fail("Variant price and stock must be valid numbers");
        statements.push(d.prepare("INSERT INTO variants(id,product_id,label,color,price_cents,total_stock,damaged_stock,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(id(),productId,label,asText(v.color,50) || null,price,stock,now));
      }
      await d.batch(statements); return json({ ok: true });
    }
    if (body.type === "variant") {
      const productId = asText(body.productId, 50), label = asText(body.label, 80) || "Standard";
      const price = asInt(body.priceCents), stock = asInt(body.totalStock);
      if (!await d.prepare("SELECT id FROM products WHERE id=?").bind(productId).first()) return fail("Product not found");
      if (price < 0 || stock < 0 || !Number.isFinite(price) || !Number.isFinite(stock)) return fail("Invalid price or stock");
      await d.prepare("INSERT INTO variants(id,product_id,label,color,price_cents,total_stock,damaged_stock,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(id(),productId,label,asText(body.color,50) || null,price,stock,iso()).run();
      return json({ ok: true });
    }
    if (body.type === "product_update") {
      const productId = asText(body.productId, 50), name = asText(body.name, 100);
      if (!name) return fail("Name is required");
      await d.prepare("UPDATE products SET name=?, image_key=COALESCE(?,image_key) WHERE id=?").bind(name,asText(body.imageKey,120) || null,productId).run();
      return json({ ok: true });
    }
    if (body.type === "variant_update") {
      const variantId = asText(body.variantId, 50), price = asInt(body.priceCents), label = asText(body.label,80) || "Standard";
      if (price < 0 || !Number.isFinite(price)) return fail("Invalid daily price");
      await d.prepare("UPDATE variants SET label=?, color=?, price_cents=? WHERE id=?").bind(label,asText(body.color,50) || null,price,variantId).run();
      return json({ ok: true });
    }
    if (body.type === "stock") {
      const variantId = asText(body.variantId, 50), total = asInt(body.deltaTotal), damaged = asInt(body.deltaDamaged), note = asText(body.note, 250);
      if (!note || !Number.isFinite(total) || !Number.isFinite(damaged) || (!total && !damaged)) return fail("Enter a stock change and reason");
      const variant = await d.prepare("SELECT * FROM variants WHERE id=?").bind(variantId).first<{total_stock:number;damaged_stock:number}>();
      if (!variant) return fail("Variant not found");
      if (variant.total_stock + total < 0 || variant.damaged_stock + damaged < 0 || variant.damaged_stock + damaged > variant.total_stock + total) return fail("Stock count would be invalid");
      const bookings = (await d.prepare("SELECT r.start_date,r.due_date,i.quantity,i.usable_returned,i.damaged_returned FROM rental_items i JOIN rentals r ON r.id=i.rental_id WHERE i.variant_id=? AND i.quantity>i.usable_returned+i.damaged_returned").bind(variantId).all()).results as {start_date:string;due_date:string;quantity:number;usable_returned:number;damaged_returned:number}[];
      const lastDue = bookings.reduce((max,b)=>b.due_date>max?b.due_date:max,today());
      for (let date=today();date<=lastDue;date=new Date(Date.parse(date+"T00:00:00Z")+86400000).toISOString().slice(0,10)) {
        const occupied = bookings.filter(b => b.start_date <= date && (date < b.due_date || (b.due_date <= today() && b.quantity>b.usable_returned+b.damaged_returned))).reduce((s,b)=>s+b.quantity-b.usable_returned-b.damaged_returned,0);
        if (occupied > variant.total_stock+total-variant.damaged_stock-damaged) return fail("Stock is committed to bookings");
      }
      await d.batch([
        d.prepare("UPDATE variants SET total_stock=total_stock+?, damaged_stock=damaged_stock+? WHERE id=?").bind(total,damaged,variantId),
        d.prepare("INSERT INTO stock_movements(id,variant_id,kind,delta_total,delta_damaged,note,actor,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id(),variantId,"adjustment",total,damaged,note,user.user_id,iso()),
      ]);
      return json({ ok: true });
    }
    if (body.type === "party") {
      const name = asText(body.name, 100); if (!name) return fail("Party name is required");
      await d.prepare("INSERT INTO parties(id,name,phone,email,created_at) VALUES(?,?,?,?,?)").bind(id(),name,asText(body.phone,40) || null,asText(body.email,120) || null,iso()).run();
      return json({ ok: true });
    }
    if (body.type === "rental") {
      const partyId = asText(body.partyId,50), start = body.startDate, due = body.dueDate;
      const rows = Array.isArray(body.items) ? body.items : [];
      if (!await d.prepare("SELECT id FROM parties WHERE id=?").bind(partyId).first()) return fail("Choose a party");
      if (!validDate(start) || !validDate(due) || start < today() || daysBetween(start,due) < 1 || daysBetween(start,due) > 365) return fail("Choose a valid rental period of 1 to 365 days");
      if (!rows.length || rows.length > 50) return fail("Add at least one item");
      const seen = new Set<string>(), prepared: {variantId:string;quantity:number;price:number}[] = [];
      for (const row of rows) {
        const value = row as Record<string,unknown>, variantId = asText(value.variantId,50), quantity = asInt(value.quantity);
        if (!variantId || seen.has(variantId) || quantity < 1 || !Number.isFinite(quantity)) return fail("Invalid or repeated item");
        seen.add(variantId);
        const variant = await d.prepare("SELECT * FROM variants WHERE id=?").bind(variantId).first<{total_stock:number;damaged_stock:number;price_cents:number}>();
        if (!variant) return fail("Product variant not found");
        const bookings = (await d.prepare("SELECT r.start_date,r.due_date,i.quantity,i.usable_returned,i.damaged_returned FROM rental_items i JOIN rentals r ON r.id=i.rental_id WHERE i.variant_id=? AND i.quantity>i.usable_returned+i.damaged_returned").bind(variantId).all()).results as {start_date:string;due_date:string;quantity:number;usable_returned:number;damaged_returned:number}[];
        const available = availability(variant.total_stock,variant.damaged_stock,bookings,start,due);
        if (quantity > available) return fail(`Only ${available} available for the selected dates`);
        prepared.push({variantId,quantity,price:variant.price_cents});
      }
      const rentalId=id(), now=iso(), invoiceNo=`RL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
      await d.batch([
        d.prepare("INSERT INTO rentals(id,invoice_no,party_id,start_date,due_date,days,notes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(rentalId,invoiceNo,partyId,start,due,daysBetween(start,due),asText(body.notes,500) || null,user.user_id,now),
        ...prepared.map(x=>d.prepare("INSERT INTO rental_items(id,rental_id,variant_id,quantity,price_cents,usable_returned,damaged_returned) VALUES(?,?,?,?,?,0,0)").bind(id(),rentalId,x.variantId,x.quantity,x.price)),
      ]);
      return json({ ok: true, rentalId });
    }
    if (body.type === "return") {
      const rentalId = asText(body.rentalId,50), rows = Array.isArray(body.items) ? body.items : [];
      if (!rows.length) return fail("Enter returned quantities");
      const statements: D1PreparedStatement[] = [];
      for (const row of rows) {
        const value=row as Record<string,unknown>, itemId=asText(value.itemId,50), usable=asInt(value.usable), damaged=asInt(value.damaged);
        if (!Number.isFinite(usable)||!Number.isFinite(damaged)||usable<0||damaged<0||usable+damaged<1) return fail("Invalid return quantity");
        const item=await d.prepare("SELECT * FROM rental_items WHERE id=? AND rental_id=?").bind(itemId,rentalId).first<{quantity:number;usable_returned:number;damaged_returned:number;variant_id:string}>();
        if (!item || usable+damaged>item.quantity-item.usable_returned-item.damaged_returned) return fail("Return exceeds outstanding quantity");
        statements.push(d.prepare("UPDATE rental_items SET usable_returned=usable_returned+?,damaged_returned=damaged_returned+? WHERE id=?").bind(usable,damaged,itemId));
        if (damaged) statements.push(d.prepare("UPDATE variants SET damaged_stock=damaged_stock+? WHERE id=?").bind(damaged,item.variant_id));
        statements.push(d.prepare("INSERT INTO return_events(id,rental_item_id,usable,damaged,note,actor,created_at) VALUES(?,?,?,?,?,?,?)").bind(id(),itemId,usable,damaged,asText(body.note,250)||null,user.user_id,iso()));
      }
      await d.batch(statements); return json({ ok:true });
    }
    return fail("Unknown action");
  } catch (error) {
    console.error(error);
    return fail(error instanceof Error && /capacity|stock|quantity/i.test(error.message) ? error.message : "Could not save. Please refresh and try again.", 409);
  }
}
