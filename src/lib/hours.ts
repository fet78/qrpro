import { z } from "zod";

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");

export const dayHoursSchema = z.object({
  open: z.boolean(),
  from: time,
  to: time,
  /** Pause déjeuner facultative. */
  breakFrom: z.union([time, z.literal("")]).default(""),
  breakTo: z.union([time, z.literal("")]).default(""),
});
export const hoursSchema = z.array(dayHoursSchema).length(7);
export type DayHours = z.infer<typeof dayHoursSchema>;

export const DEFAULT_HOURS: DayHours[] = DAYS.map((_, i) => ({
  open: i < 5,
  from: "08:00",
  to: "18:00",
  breakFrom: i < 5 ? "12:00" : "",
  breakTo: i < 5 ? "14:00" : "",
}));

export function parseHours(raw: unknown): DayHours[] {
  const parsed = hoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_HOURS;
}

function h(t: string) {
  return t.replace(":", "h").replace("h00", "h");
}

export function dayLabel(d: DayHours): string {
  if (!d.open) return "Fermé";
  if (d.breakFrom && d.breakTo) return `${h(d.from)} – ${h(d.breakFrom)}, ${h(d.breakTo)} – ${h(d.to)}`;
  return `${h(d.from)} – ${h(d.to)}`;
}

/** Ouvert maintenant (heure de Paris) ? */
export function openNow(hours: DayHours[], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const idx = DAYS.findIndex((d) => d.toLowerCase() === weekday.toLowerCase());
  const hhmm = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
  const d = hours[idx];
  if (!d?.open) return false;
  if (hhmm < d.from || hhmm >= d.to) return false;
  if (d.breakFrom && d.breakTo && hhmm >= d.breakFrom && hhmm < d.breakTo) return false;
  return true;
}

// ------------------------------------------------------------------ Statut intelligent

export interface HoursStatus {
  open: boolean;
  /** « Ouvert · ferme à 18 h », « Fermé · ouvre demain à 8 h »… */
  label: string;
  /** Fermeture dans moins d'une heure (ou ouverture imminente). */
  soon: boolean;
}

function parisNow(now: Date) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = DAYS.findIndex((d) => d.toLowerCase() === weekday.toLowerCase());
  const minutes = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  return { day, minutes };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} h ${String(mm).padStart(2, "0")}` : `${h} h`;
};

/** Plages d'ouverture d'une journée, pause déjeuner déduite. */
function ranges(d: DayHours): [number, number][] {
  if (!d.open) return [];
  const from = toMin(d.from);
  const to = toMin(d.to);
  if (d.breakFrom && d.breakTo && toMin(d.breakFrom) > from && toMin(d.breakTo) < to) return [[from, toMin(d.breakFrom)], [toMin(d.breakTo), to]];
  return [[from, to]];
}

/** Statut « comme Google Maps » : ouvert maintenant, ferme bientôt, prochaine ouverture. Heure de Paris. */
export function hoursStatus(hours: DayHours[], now = new Date()): HoursStatus | null {
  if (!hours.some((d) => d.open)) return null;
  const { day, minutes } = parisNow(now);
  for (const [a, b] of ranges(hours[day]!)) {
    if (minutes >= a && minutes < b) {
      const left = b - minutes;
      return { open: true, soon: left <= 60, label: left <= 60 ? `Ouvert · ferme dans ${left} min` : `Ouvert · ferme à ${fmt(b)}` };
    }
  }
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    const next = ranges(hours[d]!).find(([a]) => offset > 0 || a > minutes);
    if (!next) continue;
    const at = fmt(next[0]);
    if (offset === 0) {
      const wait = next[0] - minutes;
      return { open: false, soon: wait <= 60, label: wait <= 60 ? `Fermé · ouvre dans ${wait} min` : `Fermé · ouvre à ${at}` };
    }
    return { open: false, soon: false, label: offset === 1 ? `Fermé · ouvre demain à ${at}` : `Fermé · ouvre ${DAYS[d]!.toLowerCase()} à ${at}` };
  }
  return { open: false, soon: false, label: "Fermé" };
}
