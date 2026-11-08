/** Formatage FR, partagé navigateur / serveur. */

export function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function eurosExact(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function dateFr(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" } : { dateStyle: "long", timeZone: "Europe/Paris" }).format(date);
}

export function orderNumber(n: number): string {
  return `CMD-${String(n).padStart(5, "0")}`;
}

/** « 0612345678 » → « 06 12 34 56 78 » ; garde tel quel ce qui n'est pas un numéro français. */
export function phoneFr(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  if (/^\+33\d{9}$/.test(digits)) return `+33 ${digits.slice(3, 4)} ${digits.slice(4).replace(/(\d{2})(?=\d)/g, "$1 ")}`.trim();
  return raw.trim();
}

export function telHref(raw: string): string {
  return `tel:${raw.replace(/[^\d+]/g, "")}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} ${n > 1 ? many : one}`;
}
