import jsQR from "jsqr";
import { qrMatrix, isDark, QR_QUIET_ZONE, type QrMatrix } from "./qr";

/**
 * Contrôle automatique : la matrice est rastérisée (comme une impression) puis décodée par
 * un lecteur indépendant (jsQR). Le contenu lu doit être exactement l'URL attendue.
 */
export function decodeMatrix(m: QrMatrix, pxPerModule = 4): string | null {
  const side = (m.size + 2 * QR_QUIET_ZONE) * pxPerModule;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!isDark(m, r, c)) continue;
      for (let dy = 0; dy < pxPerModule; dy++) {
        const y = (r + QR_QUIET_ZONE) * pxPerModule + dy;
        for (let dx = 0; dx < pxPerModule; dx++) {
          const i = (y * side + (c + QR_QUIET_ZONE) * pxPerModule + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

export function verifyUrlEncodes(url: string): boolean {
  return decodeMatrix(qrMatrix(url)) === url;
}

/** Décode une image (canvas) : sert à vérifier un PNG exporté avant son téléchargement. */
export function decodeImageData(img: { data: Uint8ClampedArray; width: number; height: number }): string | null {
  return jsQR(img.data, img.width, img.height)?.data ?? null;
}
