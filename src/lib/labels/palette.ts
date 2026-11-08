/**
 * Couleurs prédéfinies. « main » porte du texte blanc (contraste ≥ 4,5:1, vérifié par les tests),
 * « light » sert de couleur d'accent sur fond sombre, « soft » de fond clair.
 * Le QR code lui-même est TOUJOURS noir sur blanc : aucune couleur ne peut le dégrader.
 */
export const ACCENTS = {
  bleu: { name: "Bleu", main: "#1D4ED8", light: "#93C5FD", soft: "#EFF4FF" },
  marine: { name: "Marine", main: "#1E3A5F", light: "#BFDBFE", soft: "#EEF3F9" },
  vert: { name: "Vert", main: "#15803D", light: "#86EFAC", soft: "#ECFDF3" },
  rouge: { name: "Rouge", main: "#B91C1C", light: "#FCA5A5", soft: "#FEF2F2" },
  orange: { name: "Orange", main: "#C2410C", light: "#FDBA74", soft: "#FFF4ED" },
  violet: { name: "Violet", main: "#6D28D9", light: "#C4B5FD", soft: "#F5F3FF" },
  or: { name: "Or", main: "#8A6A12", light: "#E9CF7A", soft: "#FBF7EA" },
  anthracite: { name: "Anthracite", main: "#1F2937", light: "#E5E7EB", soft: "#F3F4F6" },
} as const;

export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

export function isAccentKey(v: unknown): v is AccentKey {
  return typeof v === "string" && v in ACCENTS;
}

export function accent(key: string) {
  return ACCENTS[isAccentKey(key) ? key : "bleu"];
}

export const QR_DARK = "#000000";
export const QR_LIGHT = "#FFFFFF";

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
