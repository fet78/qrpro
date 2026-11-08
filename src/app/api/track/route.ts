import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { rateLimit, clientIp } from "@/server/rate-limit";

const ACTIONS = new Set(["view", "call", "whatsapp", "sms", "email", "directions", "save", "share", "review", "website", "calendar", "request_open", "link"]);

/**
 * Statistiques anonymes de la vitrine : on compte des clics, sans IP stockée, sans cookie, sans
 * identifiant. Les visites du professionnel lui-même ne sont pas comptées.
 */
export async function POST(req: Request) {
  let body: { slug?: unknown; action?: unknown; code?: unknown };
  try {
    body = JSON.parse((await req.text()).slice(0, 500));
  } catch {
    return new Response(null, { status: 204 });
  }
  const slug = typeof body.slug === "string" ? body.slug.slice(0, 60) : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!slug || !ACTIONS.has(action)) return new Response(null, { status: 204 });
  const ip = await clientIp();
  if (!(await rateLimit("track", `${ip}|${slug}|${action}`, 20, 3600))) return new Response(null, { status: 204 });
  const b = await db.business.findUnique({ where: { slug }, select: { id: true } });
  if (!b) return new Response(null, { status: 204 });
  const viewer = await getCurrentUser();
  if (viewer?.businessId === b.id) return new Response(null, { status: 204 });
  await db.pageEvent.create({ data: { businessId: b.id, action, withCode: typeof body.code === "string" && body.code.length > 0 } });
  return new Response(null, { status: 204 });
}
