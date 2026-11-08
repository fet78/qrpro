/** Affiche une information légale, ou un repère visible « à compléter » si elle manque dans les réglages. */
export function Fill({ value, label }: { value: string; label: string }) {
  return value ? <>{value}</> : <mark className="rounded bg-warn-soft px-1 text-warn">[{label} à compléter dans Administration → Réglages]</mark>;
}

export function DraftNotice() {
  return (
    <p className="rounded-xl border border-warn/20 bg-warn-soft px-4 py-3 text-[14px]">
      Modèle de document fourni avec l&apos;application : à relire et à faire valider avant la mise en vente.
    </p>
  );
}
