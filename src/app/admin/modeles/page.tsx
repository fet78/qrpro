import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { renderLabelSvg, SAMPLE_DATA } from "@/server/label-render";
import { PageHeader, Card, Notice, Badge } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { LabelSvg } from "@/components/label-preview";
import { TEMPLATES, CATEGORIES, buildTemplate, formatsOf } from "@/lib/labels/library";
import { saveTemplate } from "../actions";

export const metadata = { title: "Modèles d'étiquettes" };

export default async function AdminTemplates() {
  await requireAdmin();
  const rows = await db.template.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const items = await Promise.all(
    TEMPLATES.map(async (t, i) => {
      const row = byKey.get(t.key);
      return {
        key: t.key,
        category: t.category,
        name: row?.name ?? t.name,
        description: row?.description ?? t.description,
        position: row?.position ?? i + 1,
        active: row?.active ?? true,
        svg: await renderLabelSvg(buildTemplate(t.key, formatsOf(t).includes("F60X40") ? "F60X40" : formatsOf(t)[0]!), SAMPLE_DATA),
      };
    }),
  );
  items.sort((a, b) => a.position - b.position);
  return (
    <>
      <PageHeader title="Modèles d'étiquettes" description={`${items.filter((i) => i.active).length} modèles proposés sur ${items.length}. Nom, description, ordre et disponibilité de chaque modèle.`} />
      <Notice className="mb-6">
        Les compositions sont définies dans le code (src/lib/labels/library.ts) : chacune est testée automatiquement dans tous ses formats (QR lisible, textes dans les marges, contrastes). Les clients peuvent ensuite tout modifier dans l&apos;éditeur.
      </Notice>
      {CATEGORIES.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-[15px] font-semibold">{cat}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items
              .filter((t) => t.category === cat)
              .map((t) => (
                <Card key={t.key} className="p-5">
                  <div className="mb-4 flex items-center gap-4">
                    <LabelSvg svg={t.svg} className="w-[96px] flex-none" />
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] text-faint">{t.key}</div>
                      {t.active ? <Badge tone="success">Proposé</Badge> : <Badge>Masqué</Badge>}
                    </div>
                  </div>
                  <ActionForm action={saveTemplate} className="grid gap-3">
                    <input type="hidden" name="key" value={t.key} />
                    <div className="grid grid-cols-[1fr_72px] gap-3">
                      <div><label className="label">Nom</label><input className="input" name="name" defaultValue={t.name} /><FieldError name="name" /></div>
                      <div><label className="label">Ordre</label><input className="input" name="position" inputMode="numeric" defaultValue={t.position} /></div>
                    </div>
                    <div><label className="label">Description</label><input className="input" name="description" defaultValue={t.description} maxLength={160} /></div>
                    <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="active" defaultChecked={t.active} className="h-4 w-4 accent-[rgb(var(--brand))]" /> Proposé aux clients</label>
                    <SubmitButton variant="secondary" size="sm">Enregistrer</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
