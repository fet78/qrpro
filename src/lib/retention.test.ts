import { describe, expect, it } from "vitest";
import { PURGE_INTERVAL_MS, purgeDue, retentionCutoffs } from "./retention";

describe("durées de conservation", () => {
  const now = new Date("2026-11-21T03:00:00Z");
  const c = retentionCutoffs(now);

  it("calcule les dates limites", () => {
    expect(c.requests.toISOString()).toBe("2024-11-21T03:00:00.000Z");
    expect(c.pageEvents.toISOString()).toBe("2025-10-21T03:00:00.000Z");
    expect(c.emailUsageDay).toBe("2026-08-21");
    expect(c.stripeEvents.toISOString()).toBe("2026-08-23T03:00:00.000Z");
  });

  it("avertit 14 jours avant les 6 mois d'inactivité, et supprime 14 jours après l'avertissement", () => {
    expect(c.inactiveTrial.toISOString()).toBe("2026-06-04T03:00:00.000Z");
    expect(c.warnedBefore.toISOString()).toBe("2026-11-07T03:00:00.000Z");
  });

  it("ne purge qu'une fois par jour environ", () => {
    expect(purgeDue(null, now)).toBe(true);
    expect(purgeDue(new Date(now.getTime() - 3600_000), now)).toBe(false);
    expect(purgeDue(new Date(now.getTime() - PURGE_INTERVAL_MS), now)).toBe(true);
  });
});
