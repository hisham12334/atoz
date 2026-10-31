import { env } from "cloudflare:workers";
import { fail, id, json, member } from "@/lib/rental";
export async function POST(request: Request) {
  if (!await member()) return fail("Sign in required",401);
  if (!env.BUCKET) return fail("Image storage unavailable",500);
  const file = await request.blob();
  if (file.type !== "image/webp" || file.size > 800_000 || file.size < 100) return fail("Upload a compressed WebP image under 800 KB");
  const key = id() + ".webp";
  await env.BUCKET.put(key,file,{httpMetadata:{contentType:"image/webp"}});
  return json({key});
}
export async function GET(request: Request) {
  if (!await member()) return fail("Sign in required",401);
  if (!env.BUCKET) return fail("Image storage unavailable",500);
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^[0-9a-f-]{36}\.webp$/.test(key)) return fail("Invalid image",400);
  const object = await env.BUCKET.get(key);
  if (!object) return fail("Image not found",404);
  return new Response(object.body,{headers:{"Content-Type":"image/webp","Cache-Control":"private, max-age=86400"}});
}
