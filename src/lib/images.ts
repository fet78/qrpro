/** Lecture des dimensions d'images directement dans l'en-tête (aucune dépendance, aucun décodage). */

export function pngSize(buf: Uint8Array): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || sig.some((b, i) => buf[i] !== b)) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (String.fromCharCode(buf[12]!, buf[13]!, buf[14]!, buf[15]!) !== "IHDR") return null;
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

/** JPEG : parcourt les segments jusqu'au marqueur SOF (début de trame) qui porte les dimensions. */
export function jpegSize(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = dv.getUint16(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
    i += 2 + len;
  }
  return null;
}
