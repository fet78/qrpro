import { describe, expect, it } from "vitest";
import { hoursStatus, DEFAULT_HOURS, type DayHours } from "@/lib/hours";
import { whatsappLink, isMobile, parsePageConfig, DEFAULT_PAGE, certIsValid } from "./config";

/** Dates en heure de Paris (novembre : UTC+1). Le 6 novembre 2026 est un vendredi. */
const at = (iso: string) => new Date(`${iso}+01:00`);

describe("Statut des horaires", () => {
  const h: DayHours[] = DEFAULT_HOURS; // lun–ven 8–18 h, pause 12–14 h
  it("ouvert, avec l'heure de fermeture", () => {
    expect(hoursStatus(h, at("2026-11-06T09:30:00"))).toEqual({ open: true, soon: false, label: "Ouvert · ferme à 12 h" });
  });
  it("ferme bientôt", () => {
    expect(hoursStatus(h, at("2026-11-06T17:20:00"))?.label).toBe("Ouvert · ferme dans 40 min");
  });
  it("pause déjeuner : réouverture le jour même", () => {
    expect(hoursStatus(h, at("2026-11-06T12:30:00"))?.label).toBe("Fermé · ouvre dans 90 min".replace("dans 90 min", "à 14 h"));
  });
  it("vendredi soir : prochaine ouverture lundi", () => {
    expect(hoursStatus(h, at("2026-11-06T19:00:00"))?.label).toBe("Fermé · ouvre lundi à 8 h");
  });
  it("jeudi soir : ouvre demain", () => {
    expect(hoursStatus(h, at("2026-11-05T20:00:00"))?.label).toBe("Fermé · ouvre demain à 8 h");
  });
  it("aucun horaire renseigné : pas de statut", () => {
    expect(hoursStatus(h.map((d) => ({ ...d, open: false })))).toBeNull();
  });
});

describe("Liens de contact", () => {
  it("WhatsApp au format international", () => {
    expect(whatsappLink("06 12 34 56 78")).toBe("https://wa.me/33612345678");
    expect(whatsappLink("+33 6 12 34 56 78", "Bonjour")).toBe("https://wa.me/33612345678?text=Bonjour");
    expect(whatsappLink("abc")).toBeNull();
  });
  it("détecte les mobiles", () => {
    expect(isMobile("07 11 22 33 44")).toBe(true);
    expect(isMobile("04 72 00 00 00")).toBe(false);
  });
  it("certification expirée", () => {
    expect(certIsValid("2020-01-01")).toBe(false);
    expect(certIsValid("")).toBe(true);
  });
});

describe("Configuration de la page", () => {
  it("complète une configuration partielle ou invalide", () => {
    expect(parsePageConfig(null)).toEqual(DEFAULT_PAGE);
    expect(parsePageConfig({ style: "nuit" }).style).toBe("nuit");
    expect(parsePageConfig({ style: "inexistant" }).style).toBe("moderne");
  });
  it("ajoute les sections apparues après l'enregistrement", () => {
    const cfg = parsePageConfig({ sections: [{ key: "request", visible: true }] });
    expect(cfg.sections[0]!.key).toBe("request");
    expect(cfg.sections.length).toBe(DEFAULT_PAGE.sections.length);
  });
});
