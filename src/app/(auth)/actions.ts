"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, verifyPassword, burnPasswordTime } from "@/server/auth/password";
import { openSession, closeSession, revokeAllSessions } from "@/server/auth/session";
import { newToken, hashToken } from "@/server/auth/tokens";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { availableSlug } from "@/server/business";
import { defaultDoc } from "@/lib/labels/content";
import { getSettings } from "@/server/settings";
import { sendEmail, notifyAdmin } from "@/server/email";
import { appUrl } from "@/lib/env";
import { DEFAULT_HOURS } from "@/lib/hours";
import { bool, fail, str, zodErrors, type ActionResult } from "@/lib/action";
import type { Prisma } from "@/generated/prisma/client";

const email = z.string().trim().toLowerCase().email("Adresse email invalide").max(160);
const password = z.string().min(10, "10 caractères minimum").max(200, "200 caractères maximum");

const signupSchema = z.object({
  company: z.string().trim().min(2, "Indiquez le nom de votre entreprise").max(80, "80 caractères maximum"),
  email,
  password,
  accept: z.literal(true, { message: "Vous devez accepter les conditions pour créer un compte" }),
});

export async function signup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({ company: str(fd, "company"), email: str(fd, "email"), password: str(fd, "password"), accept: bool(fd, "accept") });
  if (!parsed.success) return zodErrors(parsed.error);
  if (!(await rateLimit("signup", await clientIp(), 5, 3600))) return fail("Trop de créations de compte depuis cette connexion. Réessayez dans une heure.");

  const { company, email: mail, password: pw } = parsed.data;
  if (await db.user.findUnique({ where: { email: mail }, select: { id: true } })) {
    return { ok: false, message: "Un compte existe déjà avec cet email.", errors: { email: "Déjà utilisé — connectez-vous ou réinitialisez votre mot de passe." } };
  }
  const slug = await availableSlug(company);
  const user = await db.user.create({
    data: {
      email: mail,
      passwordHash: await hashPassword(pw),
      business: {
        create: {
          slug,
          name: company,
          email: mail,
          hours: DEFAULT_HOURS,
          // Design de départ : le modèle « Bandeau pro », que le pro personnalise dans l'éditeur.
          design: { create: { doc: defaultDoc() as unknown as Prisma.InputJsonValue, templateKey: "professionnel" } },
        },
      },
    },
  });
  await openSession(user.id);
  void notifyAdmin(`Nouveau compte : ${company}`, `${company} (${mail}) vient de créer un compte.\n\n${appUrl()}/admin/clients`);
  redirect("/espace?bienvenue=1");
}

function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "";
}

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ email, password: z.string().min(1, "Mot de passe requis").max(200) }).safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) return zodErrors(parsed.error);
  const ip = await clientIp();
  const okIp = await rateLimit("login-ip", ip, 40, 900);
  const okPair = await rateLimit("login", `${parsed.data.email}|${ip}`, 8, 900);
  if (!okIp || !okPair) return fail("Trop de tentatives. Patientez 15 minutes avant de réessayer.");

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true, disabledAt: true, role: true } });
  if (!user) {
    await burnPasswordTime(parsed.data.password);
    return fail("Email ou mot de passe incorrect.");
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail("Email ou mot de passe incorrect.");
  if (user.disabledAt) return fail("Ce compte est désactivé. Contactez le support pour le réactiver.");
  await openSession(user.id);
  const next = safeNext(str(fd, "next"));
  redirect(next || (user.role === "ADMIN" ? "/admin" : "/espace"));
}

export async function logout(): Promise<void> {
  await closeSession();
  redirect("/connexion");
}

export async function forgotPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = email.safeParse(str(fd, "email"));
  if (!parsed.success) return { ok: false, errors: { email: "Adresse email invalide" } };
  if (!(await rateLimit("forgot", await clientIp(), 6, 3600))) return fail("Trop de demandes. Réessayez dans une heure.");
  const generic = { ok: true, message: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé (valable 1 heure)." };
  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, disabledAt: true } });
  if (!user || user.disabledAt) return generic;
  if (!(await rateLimit("forgot-user", user.id, 3, 3600))) return generic;
  const { token, hash } = newToken();
  await db.passwordReset.create({ data: { tokenHash: hash, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const { brandName } = await getSettings();
  await sendEmail(
    parsed.data,
    `${brandName} — réinitialisation de votre mot de passe`,
    `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${appUrl()}/reinitialiser/${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.`,
  );
  return generic;
}

export async function resetPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ token: z.string().min(20).max(200), password }).safeParse({ token: str(fd, "token"), password: str(fd, "password") });
  if (!parsed.success) return zodErrors(parsed.error);
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return fail("Ce lien n'est plus valable. Faites une nouvelle demande.");
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  await revokeAllSessions(reset.userId);
  await openSession(reset.userId);
  redirect("/espace");
}
