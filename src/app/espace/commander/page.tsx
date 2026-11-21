import Link from "next/link";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { labelContext } from "@/server/labels";
import { paymentsAvailable } from "@/server/orders";
import { paymentSimulated } from "@/lib/env";
import { renderLabelSvg } from "@/server/label-render";
import { FORMATS } from "@/lib/labels/formats";
import { dateFr } from "@/lib/format";
import { PageHeader, Notice } from "@/components/ui";
import { Checkout } from "./checkout";

export const metadata = { title: "Offre & commande" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ quantite?: string }> }) {
  const user = await requirePro();
  const { quantite } = await searchParams;
  const [s, tiers, ctx, b, activation, account] = await Promise.all([
    getSettings(),
    db.printTier.findMany({ where: { active: true }, orderBy: { quantity: "asc" } }),
    labelContext(user.businessId),
    db.business.findUniqueOrThrow({
      where: { id: user.businessId },
      select: {
        name: true, phone: true, address: true, postalCode: true, city: true,
        billName: true, billLine1: true, billLine2: true, billPostal: true, billCity: true, billSiret: true,
        shipName: true, shipLine1: true, shipLine2: true, shipPostal: true, shipCity: true, shipPhone: true,
      },
    }),
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { activatedAt: true } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true } }),
  ]);
  const emailOk = !!account.emailVerifiedAt;
  const canPay = paymentsAvailable();
  const printOn = s.printEnabled && tiers.length > 0;
  const preselect = tiers.find((t) => String(t.quantity) === quantite)?.id;

  return (
    <>
      <PageHeader
        title="Offre & commande"
        description="Une offre unique pour votre QR code et votre page, et si vous le souhaitez, vos étiquettes imprimées et livrées. Le prix affiché est le prix payé."
      />
      {!canPay ? <Notice tone="warn" className="mb-6">Le paiement en ligne n&apos;est pas encore activé sur ce site. Les commandes seront possibles dès sa mise en service.</Notice> : null}
      {canPay && !emailOk ? (
        <Notice tone="warn" className="mb-6">Confirmez d&apos;abord votre adresse email (lien envoyé à <b>{user.email}</b>) : c&apos;est là que nous envoyons votre facture.</Notice>
      ) : null}
      {paymentSimulated() ? (
        <Notice tone="warn" className="mb-6">Mode développement : Stripe n&apos;est pas configuré, le paiement sera <b>simulé</b> (aucun débit). Ce mode est désactivé en production.</Notice>
      ) : null}

      <Checkout
        canPay={canPay && emailOk}
        activated={!!ctx.activated}
        activatedOn={activation.activatedAt ? dateFr(activation.activatedAt) : null}
        digitalPriceCents={s.digitalPriceCents}
        tiers={printOn ? tiers.map((t) => ({ id: t.id, quantity: t.quantity, priceCents: t.priceCents })) : []}
        printPaused={!s.printEnabled}
        preselectTierId={preselect ?? null}
        validated={ctx.validated}
        previewSvg={await renderLabelSvg(ctx.doc, ctx.data, ctx.logoDataUrl)}
        formatLabel={FORMATS[ctx.doc.format].label}
        bill={{
          billName: b.billName || b.name,
          billLine1: b.billLine1 || b.address,
          billLine2: b.billLine2,
          billPostal: b.billPostal || b.postalCode,
          billCity: b.billCity || b.city,
          billSiret: b.billSiret,
        }}
        ship={{ shipName: b.shipName, shipLine1: b.shipLine1, shipLine2: b.shipLine2, shipPostal: b.shipPostal, shipCity: b.shipCity, shipPhone: b.shipPhone || b.phone }}
      />

      <p className="mt-8 text-center text-[12.5px] text-faint">
        Paiement sécurisé par carte via Stripe · paiement unique, aucun abonnement · facture téléchargeable · {s.vatMention}.{" "}
        <Link href="/cgv" className="underline-offset-2 hover:underline">Conditions générales de vente</Link>
      </p>
    </>
  );
}
