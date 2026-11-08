import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Base en mémoire : seules les opérations utilisées par le compteur.
const rows = new Map<string, number>();
vi.mock("@/server/db", () => ({
  db: {
    emailUsage: {
      findMany: async ({ where }: { where: { day: { startsWith: string } } }) => [...rows].filter(([d]) => d.startsWith(where.day.startsWith)).map(([day, count]) => ({ day, count })),
      upsert: async ({ where, create, update }: { where: { day: string }; create: { count: number }; update: { count?: number } }) => {
        if (!rows.has(where.day)) rows.set(where.day, create.count);
        else if (update.count !== undefined) rows.set(where.day, update.count);
      },
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      const day = values[0] as string;
      if (sql.includes('"count" + 1')) {
        const cap = values[1] as number;
        const c = rows.get(day) ?? 0;
        if (c >= cap) return 0;
        rows.set(day, c + 1);
        return 1;
      }
      rows.set(day, Math.max(0, (rows.get(day) ?? 0) - 1));
      return 1;
    },
  },
}));

beforeEach(() => {
  rows.clear();
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-42";
  process.env.DATABASE_URL = "postgres://x";
  process.env.EMAIL_DAILY_LIMIT = "100";
  process.env.EMAIL_MONTHLY_LIMIT = "3000";
});

describe("Emails : jamais au-delà de l'offre gratuite", () => {
  const now = new Date("2026-11-09T10:00:00Z");

  it("les notifications s'arrêtent à 90/jour, les emails de compte peuvent aller jusqu'à 100, jamais au-delà", async () => {
    const { reserveEmail, emailUsage } = await import("./email-quota");
    let sent = 0;
    for (let i = 0; i < 95; i++) if ((await reserveEmail("notification", now)) === null) sent++;
    expect(sent).toBe(90);
    expect(await reserveEmail("notification", now)).toMatch(/Limite gratuite quotidienne/);
    let account = 0;
    for (let i = 0; i < 20; i++) if ((await reserveEmail("account", now)) === null) account++;
    expect(account).toBe(10);
    const u = await emailUsage(now);
    expect(u.today).toBe(100);
    expect(u.allBlocked).toBe(true);
  });

  it("un envoi refusé par Resend rend sa place", async () => {
    const { reserveEmail, releaseEmail, emailUsage } = await import("./email-quota");
    await reserveEmail("notification", now);
    await releaseEmail(now);
    expect((await emailUsage(now)).today).toBe(0);
  });

  it("limite mensuelle : bloque même si la journée est libre", async () => {
    const { reserveEmail } = await import("./email-quota");
    for (let d = 1; d <= 31; d++) rows.set(`2026-11-${String(d).padStart(2, "0")}`, d === 9 ? 0 : 97);
    expect(await reserveEmail("notification", now)).toMatch(/mensuelle/);
  });

  it("quota signalé par Resend : journée bloquée jusqu'à demain", async () => {
    const { markDayExhausted, reserveEmail } = await import("./email-quota");
    await markDayExhausted(now);
    expect(await reserveEmail("account", now)).not.toBeNull();
    expect(await reserveEmail("account", new Date("2026-11-10T08:00:00Z"))).toBeNull();
  });
});
