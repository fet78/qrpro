import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { labelContext } from "@/server/labels";
import { TEMPLATES } from "@/lib/labels/library";
import { Editor } from "./editor/Editor";

export const metadata = { title: "Mon étiquette" };
export const dynamic = "force-dynamic";

export default async function LabelEditorPage() {
  const user = await requirePro();
  const [ctx, rows] = await Promise.all([labelContext(user.businessId), db.template.findMany({ select: { key: true, active: true, position: true } })]);
  // Modèles proposés : ceux activés dans l'administration (un modèle absent de la base est proposé), dans l'ordre choisi.
  const pos = new Map(rows.map((r) => [r.key, r.position]));
  const activeKeys = TEMPLATES.filter((t) => rows.find((r) => r.key === t.key)?.active ?? true)
    .sort((a, b) => (pos.get(a.key) ?? 99) - (pos.get(b.key) ?? 99))
    .map((t) => t.key);
  return <Editor initial={ctx.doc} data={ctx.data} logoHref={ctx.logoDataUrl} activeKeys={activeKeys} validated={ctx.validated} draftKey={`qrpro-draft-${user.businessId}`} photos={ctx.photos} startInGallery={!ctx.validated} />;
}
