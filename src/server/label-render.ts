import "server-only";
import { loadServerFonts } from "@/lib/labels/fonts-server";
import { renderDoc } from "@/lib/labels/render";
import { labelSvg } from "@/lib/labels/svg";
import type { LabelDoc, LabelData } from "@/lib/labels/doc";

/** SVG d'une étiquette rendu côté serveur (aperçus des pages, sans charger les polices dans le navigateur). */
export async function renderLabelSvg(doc: LabelDoc, data: LabelData, logoHref: string | null = null, pxWidth?: number): Promise<string> {
  await loadServerFonts();
  const images = Object.fromEntries(Object.keys(data.images ?? {}).map((id) => [id, `/api/photos/${id}`]));
  return labelSvg(renderDoc(doc, data), { logoHref, pxWidth, images });
}

export const SAMPLE_DATA: LabelData = {
  name: "Exemple Chauffage",
  trade: "Chauffagiste · PAC",
  phone: "06 12 34 56 78",
  email: "contact@exemple.fr",
  website: "exemple.fr",
  city: "Lyon",
  zone: "Lyon et alentours",
  url: "https://exemple.fr/q/ABCDEFG",
  code: "ABCDEFG",
  logo: null,
};
