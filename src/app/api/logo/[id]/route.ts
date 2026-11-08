import { db } from "@/server/db";

/** Logo d'une entreprise (public : il apparaît sur sa page). Toujours servi en PNG validé. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const b = await db.business.findUnique({ where: { id }, select: { logo: true } });
  if (!b?.logo) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(b.logo), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
