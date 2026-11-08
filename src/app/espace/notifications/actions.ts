"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { rateLimit } from "@/server/rate-limit";
import { done, fail, zodErrors, type ActionResult } from "@/lib/action";
import { notifyPrefsSchema, type Channel } from "@/lib/notify/prefs";
import { emailMessage, pushPayload, type RequestForNotif } from "@/server/notify/message";
import { sendEmailChannel, sendPush } from "@/server/notify/providers";
import type { Prisma } from "@/generated/prisma/client";

/** Enregistre les préférences (JSON envoyé par la page Notifications, validé ici). */
export async function savePrefs(json: string): Promise<ActionResult> {
  const user = await requirePro();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail("Données invalides.");
  }
  const parsed = notifyPrefsSchema.safeParse(raw);
  if (!parsed.success) return zodErrors(parsed.error);
  const p = parsed.data;
  if (!p.push.on && !p.email.on) return fail("Gardez au moins un canal actif : sinon seul un email de secours vous préviendrait.");
  await db.business.update({ where: { id: user.businessId }, data: { notify: p as unknown as Prisma.InputJsonValue } });
  revalidatePath("/espace/notifications");
  return done("Préférences enregistrées : elles s'appliquent dès la prochaine demande.");
}

/** Exemple réaliste (aucune donnée de vrai client) pour les envois d'essai. */
function sample(): RequestForNotif {
  return {
    id: "essai",
    name: "Client d'essai",
    phone: "0600000000",
    email: "",
    address: "1 rue de l'Exemple",
    postalCode: "69003",
    city: "Lyon",
    kind: "intervention",
    urgency: "rapide",
    problem: "Chaudière en panne",
    message: "Ceci est un message d'essai envoyé depuis vos préférences de notification. Aucune action n'est nécessaire.",
    availability: "Matin, Samedi",
    contactPref: "appel",
    createdAt: new Date(),
    files: [],
  };
}

/** Envoi d'essai sur un canal : le pro vérifie, réellement, qu'il reçoit bien (l'essai email compte dans la limite gratuite). */
export async function sendTest(channel: Channel, to: string): Promise<ActionResult> {
  const user = await requirePro();
  if (!(await rateLimit("notif-test", user.businessId, 10, 3600))) return fail("Trop d'essais. Réessayez dans une heure.");
  const { brandName } = await getSettings();
  const r = sample();
  let res;
  if (channel === "email") {
    const dest = to || (await db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { email: true } })).email || user.email;
    const m = emailMessage(r, brandName);
    res = await sendEmailChannel(dest, `[Essai] ${m.subject}`, m.text, m.html);
  } else {
    const subs = await db.pushSubscription.findMany({ where: { businessId: user.businessId } });
    if (!subs.length) return fail("Aucun appareil enregistré : activez d'abord les notifications sur cet appareil.");
    const payload = { ...pushPayload(r), title: "Essai — notifications QR Pro", url: "/espace/notifications" };
    const results = await Promise.all(subs.map((s) => sendPush(s, payload)));
    const ok = results.filter((x) => x.ok).length;
    for (const [i, x] of results.entries()) if (!x.ok && x.permanent) await db.pushSubscription.delete({ where: { id: subs[i]!.id } }).catch(() => undefined);
    res = ok ? { ok: true } : { ok: false, error: results[0]?.error };
  }
  if (!res.ok && "quota" in res && res.quota) return fail(`Non envoyé : ${res.error}`);
  return res.ok ? done("Envoyé : vérifiez que vous l'avez bien reçu.") : fail(`Échec : ${res.error ?? "envoi impossible"}`);
}

/** Enregistre l'abonnement push de cet appareil (navigateur). */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string): Promise<ActionResult> {
  const user = await requirePro();
  if (!/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || !sub.keys?.p256dh || !sub.keys?.auth) return fail("Abonnement invalide.");
  const count = await db.pushSubscription.count({ where: { businessId: user.businessId } });
  if (count >= 10) return fail("10 appareils maximum : retirez-en un.");
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { businessId: user.businessId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 60) },
    update: { businessId: user.businessId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 60) },
  });
  revalidatePath("/espace/notifications");
  return done("Cet appareil recevra les nouvelles demandes.");
}

export async function removePushSubscription(id: string): Promise<ActionResult> {
  const user = await requirePro();
  await db.pushSubscription.deleteMany({ where: { id, businessId: user.businessId } });
  revalidatePath("/espace/notifications");
  return done("Appareil retiré.");
}
