import QRCode from "qrcode";

/**
 * Matrice QR via la bibliothèque « qrcode » (norme ISO/IEC 18004).
 * Niveau de correction Q (25 %) : l'étiquette reste lisible si elle est un peu rayée ou salie.
 * La zone blanche de sécurité (4 modules, minimum de la norme) est ajoutée au rendu.
 */
export const QR_QUIET_ZONE = 4;
export const QR_ECC = "Q" as const;
/**
 * Taille minimale d'un module imprimé (mm). 0,42 mm se lit sans difficulté par un smartphone à 30 cm
 * (une imprimante à 300 dpi le reproduit sur 5 points) ; le décodage est de toute façon vérifié.
 */
export const MIN_MODULE_MM = 0.42;

export interface QrMatrix {
  size: number;
  data: Uint8Array;
  version: number;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: QR_ECC });
  return { size: qr.modules.size, data: Uint8Array.from(qr.modules.data), version: qr.version };
}

export function isDark(m: QrMatrix, row: number, col: number): boolean {
  return m.data[row * m.size + col] === 1;
}

/** Côté d'un module (mm) quand le QR, zone de sécurité comprise, occupe `outer` mm. */
export function moduleSize(m: QrMatrix, outer: number): number {
  return outer / (m.size + 2 * QR_QUIET_ZONE);
}

/**
 * Chemin SVG des modules sombres, en coordonnées « modules » (1 unité = 1 module),
 * zone de sécurité comprise. Les modules voisins d'une ligne sont fusionnés.
 */
export function qrPath(m: QrMatrix): string {
  const parts: string[] = [];
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!isDark(m, r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < m.size && isDark(m, r, c)) c++;
      const x = start + QR_QUIET_ZONE;
      const y = r + QR_QUIET_ZONE;
      parts.push(`M${x} ${y}h${c - start}v1h${start - c}z`);
    }
  }
  return parts.join("");
}
