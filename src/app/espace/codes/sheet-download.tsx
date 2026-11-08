"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { clsx } from "clsx";
import { buttonClass } from "@/components/ui";

const PAGES = [1, 2, 5, 10] as const;

/** Choix du nombre de pages A4 puis téléchargement (gratuit, illimité : rien n'est décompté). */
export function SheetDownload({ perPage }: { perPage: number }) {
  const [pages, setPages] = useState<number>(1);
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div>
        <span className="label">Nombre de pages</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Nombre de pages">
          {PAGES.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={pages === p} onClick={() => setPages(p)} className={clsx("rounded-lg border py-2 text-center transition", pages === p ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>
              <span className="block text-[15px] font-semibold">{p}</span>
              <span className="block text-[11.5px] text-muted">{p * perPage} étiq.</span>
            </button>
          ))}
        </div>
      </div>
      <a href={`/api/sheet?pages=${pages}`} className={clsx(buttonClass("primary"), "w-full")} data-testid="sheet-download">
        <FileDown className="h-4 w-4" /> Télécharger la planche ({pages * perPage} étiquettes)
      </a>
      <p className="text-[12.5px] leading-relaxed text-muted">
        Conseil : papier autocollant A4 vinyle ou polyester (résiste à la chaleur des chaufferies), impression en « taille réelle » (100 %), sans « ajuster à la page ».
      </p>
    </div>
  );
}
