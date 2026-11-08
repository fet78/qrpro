import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, appUrl } from "@/lib/env";

/**
 * Liens signés vers les pièces jointes, pour les canaux qui ne transmettent pas de fichiers (email) :
 * valables 7 jours, liés à UN fichier, infalsifiables (HMAC avec AUTH_SECRET). Sans signature valide,
 * seul le professionnel connecté (ou l'admin) peut ouvrir la pièce jointe.
 */
const TTL = 7 * 86400;

function sig(id: string, exp: number): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`request-file:${id}:${exp}`).digest("base64url").slice(0, 32);
}

export function signedFileUrl(id: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL;
  return `${appUrl()}/api/requests/photos/${id}?e=${exp}&s=${sig(id, exp)}`;
}

export function verifyFileSignature(id: string, e: string | null, s: string | null, now = Date.now()): boolean {
  const exp = Number(e);
  if (!s || !Number.isFinite(exp) || exp < now / 1000) return false;
  const a = Buffer.from(sig(id, exp));
  const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lien court vers une demande (SMS, WhatsApp, push) : renvoie vers la connexion si besoin. */
export function requestLink(id: string): string {
  return `${appUrl()}/d/${id}`;
}
