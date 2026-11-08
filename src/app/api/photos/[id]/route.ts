import { db } from "@/server/db";

/** Photo de réalisation (publique : elle figure sur la page du professionnel). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const p = await db.photo.findUnique({ where: { id }, select: { data: true, mime: true, business: { select: { user: { select: { disabledAt: true } } } } } });
  if (!p || p.business.user.disabledAt) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(p.data), {
    headers: {
      "Content-Type": p.mime === "image/png" ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
