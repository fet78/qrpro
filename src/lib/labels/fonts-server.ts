import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_FONT_FILES, registerFont, hasFont } from "./fonts";

let loading: Promise<void> | null = null;

/** Charge toutes les polices depuis public/fonts (une seule fois par processus). */
export function loadServerFonts(): Promise<void> {
  loading ??= Promise.all(
    ALL_FONT_FILES.map(async ({ family, bold, file }) => {
      if (hasFont(family, bold)) return;
      const bytes = await readFile(path.join(process.cwd(), "public", "fonts", file));
      registerFont(family, bold, new Uint8Array(bytes));
    }),
  ).then(() => undefined);
  return loading;
}
