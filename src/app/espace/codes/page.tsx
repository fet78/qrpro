import Link from "next/link";
import { Download, FileDown, Lock, Printer, QrCode, ScanLine, Check, Palette } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { designOf } from "@/server/business";
import { labelContext } from "@/server/labels";
import { renderLabelSvg } from "@/server/label-render";
import { getSettings } from "@/server/settings";
import { PageHeader, Card, CardHeader, LinkButton, Badge, Notice, buttonClass } from "@/components/ui";
import { LabelSvg } from "@/components/label-preview";
import { PngDownload } from "@/components/png-download";
import { CopyButton } from "@/components/copy-button";
import { FORMATS, sheetLayout } from "@/lib/labels/formats";
import { appUrl } from "@/lib/env";
import { publicUrl, qrUrl } from "@/lib/labels/content";
import { euros, plural } from "@/lib/format";
import { OFFER_FEATURES } from "@/lib/pricing";
import { SheetDownload } from "./sheet-download";

export const metadata = { title: "Mes fichiers" };
export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const user = await requirePro();
  const id = user.businessId;
  const [ctx, s, design, main, legacy] = await Promise.all([
    labelContext(id),
    getSettings(),
    db.labelDesign.findUnique({ where: { businessId: id } }),
    db.qrCode.findFirst({ where: { businessId: id, main: true }, select: { id: true, code: true, scanCount: true } }),
    db.qrCode.findMany({ where: { businessId: id, main: false }, orderBy: [{ createdAt: "desc" }, { position: "asc" }], take: 100 }),
  ]);
  const doc = designOf(design);
  const validated = !!design?.validatedAt;
  const svg = await renderLabelSvg(doc, ctx.data, ctx.logoDataUrl);
  const perPage = sheetLayout(doc.format).perPage;
  const active = ctx.activated && main;

  return (
    <>
      <PageHeader
        title="Mes fichiers"
        description="Votre QR code est unique et permanent : imprimez vos étiquettes autant de fois que vous voulez, c'est toujours le même code."
        action={<LinkButton href="/espace/commander" variant="secondary"><Printer className="h-4 w-4" /> Les faire imprimer par nous</LinkButton>}
      />

      {!active ? (
        <Card className="mb-6 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_300px]">
            <div className="p-6 sm:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[12px] font-semibold text-warn"><Lock className="h-3.5 w-3.5" /> Fichiers verrouillés</span>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight">Activez l&apos;offre QR Pro pour imprimer</h2>
              <p className="mt-1.5 text-[14.5px] text-muted">{euros(s.digitalPriceCents)}, une seule fois. Sans abonnement, sans limite d&apos;impression.</p>
              <ul className="mt-4 space-y-2 text-[14px]">
                {OFFER_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-success" />{f}</li>)}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <LinkButton href="/espace/commander">Activer pour {euros(s.digitalPriceCents)}</LinkButton>
                {!validated ? <LinkButton href="/espace/etiquette" variant="secondary"><Palette className="h-4 w-4" /> Terminer mon étiquette</LinkButton> : null}
              </div>
            </div>
            <div className="grid place-items-center bg-canvas p-6">
              <LabelSvg svg={svg} className="w-full max-w-[220px] opacity-90" />
              <p className="mt-3 text-center text-[12px] text-muted">Aperçu avec un code d&apos;exemple</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Planche A4 à imprimer" description={`${perPage} étiquettes ${FORMATS[doc.format].label} par page, repères de coupe, taille réelle. Gratuit et illimité.`} />
              {validated ? (
                <SheetDownload perPage={perPage} />
              ) : (
                <div className="p-5 sm:p-6"><Notice tone="warn">Validez d&apos;abord votre étiquette dans <Link href="/espace/etiquette" className="link">Mon étiquette</Link> : c&apos;est elle qui sera imprimée.</Notice></div>
              )}
            </Card>
            <Card>
              <CardHeader title="Fichiers séparés" description="Pour un imprimeur, un autocollant de véhicule, une carte de visite, une vitrine…" />
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <div>
                  <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-muted">Votre étiquette</div>
                  <div className="flex flex-wrap gap-2">
                    <PngDownload codeId={main.id} code={main.code} expectedUrl={qrUrl(appUrl(), main.code)} label="PNG 600 dpi" />
                    <a href={`/api/codes/${main.id}/svg`} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> SVG vectoriel</a>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-muted">Le QR code seul</div>
                  <div className="flex flex-wrap gap-2">
                    <PngDownload codeId={main.id} code={main.code} expectedUrl={qrUrl(appUrl(), main.code)} type="qr" label="PNG" />
                    <a href={`/api/codes/${main.id}/svg?type=qr`} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> SVG</a>
                  </div>
                </div>
              </div>
              <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">Chaque fichier est vérifié : le QR est relu avant le téléchargement.</p>
            </Card>
          </div>
          <Card className="h-fit p-5">
            <div className="rounded-xl bg-canvas p-6"><LabelSvg svg={svg} className="mx-auto max-w-[240px]" /></div>
            <div className="mt-4 text-[12px] font-medium uppercase tracking-wider text-muted">Votre QR code</div>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <ScanLine className="h-4 w-4 flex-none text-brand" />
              <code className="min-w-0 flex-1 truncate text-[12.5px]">{qrUrl(appUrl(), main.code)}</code>
              <CopyButton value={qrUrl(appUrl(), main.code)} />
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              Mène à <a href={publicUrl(appUrl(), ctx.slug, main.code)} target="_blank" className="link">votre page</a>. Code <span className="font-mono">{main.code}</span> · {plural(main.scanCount, "scan", "scans")}.
            </p>
            <Link href="/espace/etiquette" className={`${buttonClass("secondary", "sm")} mt-4 w-full`}><Palette className="h-3.5 w-3.5" /> Modifier mon étiquette</Link>
          </Card>
        </div>
      )}

      {legacy.length ? (
        <Card>
          <CardHeader title={`Étiquettes numérotées (${legacy.length})`} description="Créées avec l'ancienne offre : elles restent actives et mènent toujours à votre page. Vous pouvez y renseigner l'installation de chaque équipement." />
          <ul className="divide-y divide-line">
            {legacy.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 sm:px-6">
                <span className="flex min-w-0 items-center gap-3 text-[14px]">
                  <QrCode className="h-4 w-4 flex-none text-faint" />
                  <span className="font-mono text-[13px]">{c.code}</span>
                  <span className="truncate text-muted">{[c.label, c.equipment].filter(Boolean).join(" · ") || "Installation non renseignée"}</span>
                  {c.showInstall ? <Badge tone="success">Visible</Badge> : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[13px] tabular-nums text-muted">{c.scanCount} scans</span>
                  <Link href={`/espace/codes/${c.id}`} className="link text-[13px]">Ouvrir</Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {active ? null : <p className="mt-2 text-center text-[12.5px] text-faint"><FileDown className="mr-1 inline h-3.5 w-3.5" />Les fichiers se débloquent dès le paiement confirmé.</p>}
    </>
  );
}
