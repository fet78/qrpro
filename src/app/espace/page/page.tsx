import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { logoUrl, photoUrl } from "@/server/public-page";
import { appUrl } from "@/lib/env";
import { parseHours } from "@/lib/hours";
import { parsePageConfig } from "@/lib/page/config";
import { PageHeader, LinkButton } from "@/components/ui";
import { PageEditor } from "./editor";

export const metadata = { title: "Ma page" };
export const dynamic = "force-dynamic";

export default async function MyPage() {
  const user = await requirePro();
  const [b, s, codes] = await Promise.all([
    db.business.findUniqueOrThrow({
      where: { id: user.businessId },
      include: {
        services: { orderBy: { position: "asc" } },
        tips: { orderBy: { position: "asc" } },
        photos: { where: { usage: "gallery" }, orderBy: { position: "asc" }, select: { id: true, width: true, height: true, caption: true } },
      },
    }),
    getSettings(),
    db.qrCode.count({ where: { businessId: user.businessId } }),
  ]);
  return (
    <>
      <PageHeader
        title="Ma page"
        description="Votre vitrine, celle que vos clients ouvrent en scannant une étiquette. Chaque modification est en ligne dès l'enregistrement."
        action={<LinkButton href={`/p/${b.slug}`} target="_blank" variant="secondary">Ouvrir ma page</LinkButton>}
      />
      <PageEditor
        baseUrl={appUrl()}
        slugLocked={codes > 0}
        brandName={s.brandName}
        initialPhotos={b.photos.map((p) => ({ id: p.id, url: photoUrl(p.id), w: p.width, h: p.height, caption: p.caption }))}
        initial={{
          slug: b.slug,
          name: b.name,
          trade: b.trade,
          phone: b.phone,
          email: b.email,
          address: b.address,
          postalCode: b.postalCode,
          city: b.city,
          zone: b.zone,
          description: b.description,
          website: b.website,
          emergency: b.emergency,
          hours: parseHours(b.hours),
          hoursNote: b.hoursNote,
          accent: b.accent,
          tipsEnabled: b.tipsEnabled,
          showRequestForm: b.showRequestForm,
          services: b.services.map((x) => ({ title: x.title, description: x.description, price: x.price })),
          tips: b.tips.map((x) => ({ title: x.title, body: x.body, url: x.url })),
          logoUrl: logoUrl({ id: b.id, logoVersion: b.logoVersion, hasLogo: b.logoWidth != null }),
          page: parsePageConfig(b.page),
        }}
      />
    </>
  );
}
