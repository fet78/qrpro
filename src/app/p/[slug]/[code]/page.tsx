import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { PencilLine } from "lucide-react";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { PublicPageView } from "@/components/public-page/view";
import { loadPublicBusiness, toPublicData } from "@/server/public-page";
import { CODE_RE } from "@/lib/slug";
import { Unavailable, NotYetOnline, PrivatePreviewBanner } from "../../unavailable";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await loadPublicBusiness(slug);
  return b ? { title: { absolute: b.name }, robots: { index: false } } : { title: "Page introuvable" };
}

/**
 * URL contenue dans le QR d'une étiquette : /p/<slug>/<code>.
 * Le code est la référence permanente ; si le slug ne correspond pas, on redirige vers l'URL exacte.
 */
export default async function LabelPage({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  if (!CODE_RE.test(code)) notFound();
  const qr = await db.qrCode.findUnique({ where: { code }, include: { business: { select: { slug: true } } } });
  if (!qr) notFound();
  if (qr.business.slug !== slug) redirect(`/p/${qr.business.slug}/${code}`);

  const b = await loadPublicBusiness(slug);
  if (!b) notFound();
  if (b.user.disabledAt) return <Unavailable />;

  const viewer = await getCurrentUser();
  const isOwner = viewer?.businessId === b.id;
  if (!b.activatedAt && !isOwner && viewer?.role !== "ADMIN") return <NotYetOnline />;
  if (!isOwner && isRealView(await headers())) {
    // Statistique de scans (aucune donnée personnelle enregistrée).
    await db.qrCode.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 }, lastScanAt: new Date() } });
  }

  return (
    <>
      {!b.activatedAt ? <PrivatePreviewBanner /> : isOwner && !qr.main ? (
        <div className="sticky top-0 z-10 bg-ink px-4 py-2.5 text-white">
          <Link href={`/espace/codes/${qr.id}`} className="mx-auto flex max-w-[480px] items-center justify-between gap-3 text-[13.5px]">
            <span>Vous êtes le propriétaire de cette étiquette ({code}).</span>
            <span className="inline-flex items-center gap-1.5 font-semibold"><PencilLine className="h-4 w-4" /> Renseigner l&apos;installation</span>
          </Link>
        </div>
      ) : null}
      <PublicPageView data={await toPublicData(b, qr)} />
    </>
  );
}

/**
 * Un « scan » = un affichage réel de la page : pas le rendu qui suit l'envoi d'un formulaire,
 * pas un préchargement, pas un robot d'aperçu de lien (WhatsApp, Facebook, moteurs…).
 */
function isRealView(h: Headers): boolean {
  if (h.has("next-action") || h.has("next-router-prefetch") || h.get("purpose") === "prefetch") return false;
  const ua = h.get("user-agent") ?? "";
  return !/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless/i.test(ua);
}
