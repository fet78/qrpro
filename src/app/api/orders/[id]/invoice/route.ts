import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { invoicePdf } from "@/server/invoice";

export const runtime = "nodejs";

/** Facture PDF d'une commande payée : le client propriétaire, ou un administrateur. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id } });
  if (!order || (user.role !== "ADMIN" && order.businessId !== user.businessId)) return new Response("Introuvable", { status: 404 });
  if (!order.invoiceNumber || !order.paidAt) return new Response("Facture disponible après le paiement.", { status: 409 });
  const pdf = await invoicePdf(order, await getSettings());
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${order.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
