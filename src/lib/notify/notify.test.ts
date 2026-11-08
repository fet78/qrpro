import { beforeAll, describe, expect, it, vi } from "vitest";
import { parsePrefs, DEFAULT_PREFS } from "./prefs";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-42";
  process.env.DATABASE_URL = "postgres://x";
  process.env.APP_URL = "https://www.monqrpro.fr";
});

const REQ = {
  id: "cmabc123def456ghi789",
  name: "Jeanne Martin",
  phone: "0612345678",
  email: "jeanne@example.fr",
  address: "12 rue des Lilas",
  postalCode: "69003",
  city: "Lyon",
  kind: "intervention",
  urgency: "urgent",
  problem: "Chaudière en panne",
  message: "Plus d'eau chaude depuis ce matin, code erreur F28 affiché.",
  availability: "Matin, Samedi",
  contactPref: "appel",
  createdAt: new Date("2026-11-08T08:30:00Z"),
  files: [
    { id: "photo1", mime: "image/jpeg", name: "img.jpg" },
    { id: "doc1", mime: "application/pdf", name: "contrat.pdf" },
  ],
};

describe("Préférences de notification (0 €)", () => {
  it("par défaut : push en priorité, email seulement en secours", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ push: { on: true }, email: { on: true, to: "", mode: "fallback" } });
  });
  it("anciennes préférences avec SMS / WhatsApp : ces canaux disparaissent, l'email reste « à chaque demande »", () => {
    const p = parsePrefs({ email: { on: true, to: "pro@example.fr" }, sms: { on: true, to: "0612345678", urgentOnly: false }, whatsapp: { on: true, to: "0612345678" }, push: { on: false } });
    expect(Object.keys(p).sort()).toEqual(["email", "push"]);
    expect(p.email).toEqual({ on: true, to: "pro@example.fr", mode: "always" });
  });
  it("valeurs stockées invalides → valeurs par défaut", () => {
    expect(parsePrefs({ email: { on: "oui" } })).toEqual(DEFAULT_PREFS);
  });
});

describe("Aucun canal payant", () => {
  it("une demande ne met en file que push / email, même avec d'anciennes préférences SMS", async () => {
    const { queueNotifications } = await import("@/server/notify/dispatch");
    const rows: { channel: string }[] = [];
    const tx = { notificationLog: { createMany: async ({ data }: { data: { channel: string }[] }) => rows.push(...data) } };
    await queueNotifications(tx as never, { id: "r1", kind: "urgence", urgency: "urgent" }, { id: "b1", email: "", userEmail: "pro@example.fr", notify: { sms: { on: true, to: "0612345678" }, whatsapp: { on: true, to: "0612345678" }, push: { on: true }, email: { on: true, to: "", mode: "fallback" } } });
    expect(rows.map((r) => r.channel)).toEqual(["push"]);
    rows.length = 0;
    await queueNotifications(tx as never, { id: "r2", kind: "devis", urgency: "flexible" }, { id: "b1", email: "", userEmail: "pro@example.fr", notify: { push: { on: true }, email: { on: true, to: "", mode: "always" } } });
    expect(rows.map((r) => r.channel)).toEqual(["push", "email"]);
    rows.length = 0;
    await queueNotifications(tx as never, { id: "r3", kind: "devis", urgency: "flexible" }, { id: "b1", email: "", userEmail: "pro@example.fr", notify: { push: { on: false }, email: { on: false, to: "", mode: "always" } } });
    expect(rows.map((r) => r.channel)).toEqual(["secours"]);
  });
});

describe("Contenu des notifications", () => {
  it("email : tout pour rappeler le client, pièces jointes en liens signés", async () => {
    const { emailMessage } = await import("@/server/notify/message");
    const m = emailMessage(REQ, "QR Pro");
    expect(m.subject).toMatch(/URGENT/);
    expect(m.subject).toContain("Jeanne Martin");
    for (const s of ["06 12 34 56 78", "12 rue des Lilas, 69003 Lyon", "Chaudière en panne", "code erreur F28", "Matin, Samedi", "/d/cmabc123def456ghi789"]) expect(m.text).toContain(s);
    expect(m.text).toMatch(/photos\/photo1\?e=\d+&s=[\w-]+/);
    expect(m.html).toContain("tel:0612345678");
    expect(m.html).not.toContain("<script");
  });
  it("email : le texte du client est échappé (pas d'injection HTML)", async () => {
    const { emailMessage } = await import("@/server/notify/message");
    const m = emailMessage({ ...REQ, message: '<img src=x onerror="alert(1)">' }, "QR Pro");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img src=x");
  });
  it("notification push : courte, lien direct vers la demande", async () => {
    const { pushPayload } = await import("@/server/notify/message");
    const p = pushPayload(REQ);
    expect(p.title).toContain("Jeanne Martin");
    expect(p.body).toContain("06 12 34 56 78");
    expect(p.url).toBe("/espace/demandes/cmabc123def456ghi789");
    expect(p.urgent).toBe(true);
  });
});

describe("Liens signés des pièces jointes", () => {
  it("valides 7 jours, liés à un fichier, infalsifiables", async () => {
    const { signedFileUrl, verifyFileSignature } = await import("@/server/notify/signed");
    const now = Date.now();
    const url = new URL(signedFileUrl("photo1", now));
    const e = url.searchParams.get("e");
    const s = url.searchParams.get("s");
    expect(verifyFileSignature("photo1", e, s, now)).toBe(true);
    expect(verifyFileSignature("photo2", e, s, now)).toBe(false); // autre fichier
    expect(verifyFileSignature("photo1", String(Number(e) + 1), s, now)).toBe(false); // date modifiée
    expect(verifyFileSignature("photo1", e, s, now + 8 * 86400_000)).toBe(false); // expiré
    expect(verifyFileSignature("photo1", e, null, now)).toBe(false);
  });
});

describe("Tailles de fichiers dans les messages", () => {
  it("lisibles : 2 Mo, 2,6 Mo, 350 Ko", async () => {
    const { sizeLabel, MAX_PDF_BYTES, MAX_TOTAL_BYTES } = await import("@/lib/page/requests");
    expect(sizeLabel(MAX_PDF_BYTES)).toBe("2 Mo");
    expect(sizeLabel(MAX_TOTAL_BYTES)).toBe("4 Mo");
    expect(sizeLabel(2.6 * 1024 * 1024)).toBe("2,6 Mo");
    expect(sizeLabel(350 * 1024)).toBe("350 Ko");
  });
});
