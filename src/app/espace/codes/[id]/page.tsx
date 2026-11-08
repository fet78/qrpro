import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Download } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { codeDoc, dataFor, logoDataUrl, LABEL_BUSINESS_SELECT } from "@/server/business";
import { renderLabelSvg } from "@/server/label-render";
import { appUrl } from "@/lib/env";
import { publicUrl, qrUrl } from "@/lib/labels/content";
import { Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { LabelSvg } from "@/components/label-preview";
import { PngDownload } from "@/components/png-download";
import { CopyButton } from "@/components/copy-button";
import { dateFr } from "@/lib/format";
import { InstallForm } from "./install-form";

export const metadata = { title: "Étiquette" };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function CodePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePro();
  const { id } = await params;
  const c = await db.qrCode.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      batch: { select: { design: true, format: true } },
      business: { select: LABEL_BUSINESS_SELECT },
      interventions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!c) notFound();
  const b = c.business;
  const url = publicUrl(appUrl(), b.slug, c.code);
  const qrContent = qrUrl(appUrl(), c.code);
  const svg = await renderLabelSvg(await codeDoc(c), dataFor(b, c.code), logoDataUrl(b));

  return (
    <>
      <Link href="/espace/codes" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Mes QR codes</Link>
      <PageHeader
        title={<span>Étiquette <span className="font-mono">{c.code}</span></span>}
        description={`Créée le ${dateFr(c.createdAt)} · ${c.scanCount} scan${c.scanCount > 1 ? "s" : ""}${c.lastScanAt ? ` · dernier le ${dateFr(c.lastScanAt, true)}` : ""}`}
        action={<a href={url} target="_blank" className={buttonClass("secondary")}><ExternalLink className="h-4 w-4" /> Ouvrir la page</a>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Informations d'installation" description="Facultatif. Affichées à la personne qui scanne CETTE étiquette, si vous cochez « Afficher »." />
          <InstallForm
            initial={{
              id: c.id,
              label: c.label,
              equipment: c.equipment,
              brand: c.brand,
              model: c.model,
              installedAt: day(c.installedAt),
              lastServiceAt: day(c.lastServiceAt),
              nextServiceAt: day(c.nextServiceAt),
              publicNote: c.publicNote,
              showInstall: c.showInstall,
            }}
          />
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="rounded-xl bg-canvas p-6"><LabelSvg svg={svg} className="mx-auto max-w-[260px]" /></div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-[12.5px]">{url}</code>
              <CopyButton value={url} />
            </div>
            <div className="mt-4 grid gap-2">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">Étiquette</span>
              <div className="flex flex-wrap gap-2">
                <PngDownload codeId={c.id} code={c.code} expectedUrl={qrContent} label="PNG 600 dpi" />
                <a href={`/api/codes/${c.id}/svg`} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> SVG</a>
              </div>
              <span className="mt-2 text-[12px] font-medium uppercase tracking-wider text-muted">QR code seul</span>
              <div className="flex flex-wrap gap-2">
                <PngDownload codeId={c.id} code={c.code} expectedUrl={qrContent} type="qr" label="PNG" />
                <a href={`/api/codes/${c.id}/svg?type=qr`} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> SVG</a>
              </div>
            </div>
          </Card>
          {c.interventions.length ? (
            <Card>
              <CardHeader title="Demandes liées" />
              <ul className="divide-y divide-line">
                {c.interventions.map((r) => (
                  <li key={r.id} className="px-5 py-3 text-[13.5px]">
                    <div className="font-medium">{r.name} · {dateFr(r.createdAt)}</div>
                    <div className="truncate text-muted">{r.message}</div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
