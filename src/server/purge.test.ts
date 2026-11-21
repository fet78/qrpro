import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ appUrl: () => "https://qrpro.test" }));
vi.mock("@/server/settings", () => ({ getSettings: async () => ({ brandName: "QR Pro" }) }));
const sendEmail = vi.fn(async (_to: string, _subject: string, _text: string) => true);
vi.mock("@/server/email", () => ({ sendEmail: (to: string, subject: string, text: string) => sendEmail(to, subject, text) }));

const count = (n: number) => vi.fn(async () => ({ count: n }));
const db = {
  setting: { updateMany: count(1) },
  interventionRequest: { findMany: vi.fn(async () => [{ id: "r1" }, { id: "r2" }]), deleteMany: count(2) },
  pageEvent: { deleteMany: count(5) },
  session: { deleteMany: count(1) },
  passwordReset: { deleteMany: count(1) },
  emailVerification: { deleteMany: count(1) },
  rateLimit: { deleteMany: count(3) },
  emailUsage: { deleteMany: count(0) },
  processedEvent: { deleteMany: count(0) },
  user: { findMany: vi.fn(), deleteMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length })), update: vi.fn(async () => ({})) },
};
vi.mock("@/server/db", () => ({ db }));

const { runDailyPurge } = await import("./purge");
const now = new Date("2026-11-21T03:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);

beforeEach(() => {
  vi.clearAllMocks();
  db.setting.updateMany.mockResolvedValue({ count: 1 });
  sendEmail.mockResolvedValue(true);
});

describe("purge RGPD", () => {
  it("ne fait rien si la purge du jour a déjà eu lieu", async () => {
    db.setting.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await runDailyPurge(now)).toEqual({ ran: false });
    expect(db.pageEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime les comptes avertis restés inactifs, pas ceux revenus depuis l'avertissement", async () => {
    db.user.findMany
      .mockResolvedValueOnce([
        { id: "a", inactivityWarnedAt: daysAgo(20), lastLoginAt: daysAgo(200) },
        { id: "b", inactivityWarnedAt: daysAgo(20), lastLoginAt: daysAgo(15) },
        { id: "c", inactivityWarnedAt: daysAgo(20), lastLoginAt: null },
      ])
      .mockResolvedValueOnce([]);
    const s = await runDailyPurge(now);
    expect(s.accountsDeleted).toBe(2);
    expect(db.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "c"] } } });
    expect(s.requests).toBe(2);
    expect(s.tokens).toBe(2);
  });

  it("avertit une seule fois par période d'inactivité, et ne marque le compte que si l'email est parti", async () => {
    db.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "new", email: "n@x.test", lastLoginAt: daysAgo(180), createdAt: daysAgo(300), inactivityWarnedAt: null },
      { id: "done", email: "d@x.test", lastLoginAt: daysAgo(180), createdAt: daysAgo(300), inactivityWarnedAt: daysAgo(5) },
      { id: "back", email: "b@x.test", lastLoginAt: daysAgo(180), createdAt: daysAgo(300), inactivityWarnedAt: daysAgo(400) },
      { id: "fail", email: "f@x.test", lastLoginAt: null, createdAt: daysAgo(200), inactivityWarnedAt: null },
    ]);
    sendEmail.mockImplementation(async (to: string) => to !== "f@x.test");
    const s = await runDailyPurge(now);
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(s.warned).toBe(2);
    expect(db.user.update.mock.calls.map((c) => (c as unknown as [{ where: { id: string } }])[0].where.id)).toEqual(["new", "back"]);
  });
});
