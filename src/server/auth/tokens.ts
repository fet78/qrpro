import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** Jeton opaque : seule son empreinte est stockée (une fuite de la base ne donne aucune session). */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(token).digest("base64url");
}

/** Empreinte non réversible (adresse IP, email) pour les compteurs anti-abus. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(`${env().AUTH_SECRET}:${value}`).digest("base64url").slice(0, 32);
}
