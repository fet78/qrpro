"use client";

import { ALL_FONT_FILES, registerFont, hasFont } from "./fonts";

let loading: Promise<void> | null = null;

/** Télécharge et enregistre toutes les polices dans le navigateur (mises en cache par le navigateur). */
export function loadClientFonts(): Promise<void> {
  loading ??= Promise.all(
    ALL_FONT_FILES.map(async ({ family, bold, file }) => {
      if (hasFont(family, bold)) return;
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) throw new Error(`Police introuvable : ${file}`);
      registerFont(family, bold, new Uint8Array(await res.arrayBuffer()));
    }),
  ).then(() => undefined);
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
