import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPageView } from "@/components/public-page/view";
import { loadPublicBusiness, toPublicData } from "@/server/public-page";
import { Unavailable, NotYetOnline, PrivatePreviewBanner } from "../unavailable";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await loadPublicBusiness(slug);
  if (!b) return { title: "Page introuvable" };
  if (!b.activatedAt) return { title: { absolute: b.name }, robots: { index: false } };
  return { title: { absolute: b.name }, description: [b.trade, b.zone].filter(Boolean).join(" · ") || undefined };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await loadPublicBusiness(slug);
  if (!b) notFound();
  if (b.user.disabledAt) return <Unavailable />;
  if (!b.activatedAt) {
    const viewer = await getCurrentUser();
    if (viewer?.businessId !== b.id && viewer?.role !== "ADMIN") return <NotYetOnline />;
    return (
      <>
        <PrivatePreviewBanner />
        <PublicPageView data={await toPublicData(b, null)} />
      </>
    );
  }
  return <PublicPageView data={await toPublicData(b, null)} />;
}
