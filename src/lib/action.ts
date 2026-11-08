/** Résultat standard d'une action serveur, affiché par <ActionForm>. */
export type ActionResult = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;

import type { ZodError } from "zod";

export function zodErrors(error: ZodError): ActionResult {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, message: "Certains champs sont à corriger.", errors };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

export function done(message = "Enregistré."): ActionResult {
  return { ok: true, message };
}

/** Lecture d'un champ texte de FormData (jamais de File). */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
