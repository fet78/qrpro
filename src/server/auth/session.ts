import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { env, isProd } from "@/lib/env";
import { hashToken, newToken } from "./tokens";

/** Préfixe __Host- (cookie lié au domaine exact, HTTPS obligatoire) dès que le site est servi en HTTPS. */
const secureCookies = () => isProd() && env().APP_URL.startsWith("https://");
export const sessionCookie = () => (secureCookies() ? "__Host-qrpro_session" : "qrpro_session");
const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  email: string;
  role: "PRO" | "ADMIN";
  sessionId: string;
  businessId: string | null;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function openSession(userId: string): Promise<void> {
  const { token, hash } = newToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.session.create({ data: { tokenHash: hash, userId, userAgent: ua, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(sessionCookie(), token, cookieOptions(SESSION_DAYS * 86400));
}

export async function closeSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookie())?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(sessionCookie());
}

/** Vérification qui fait foi : session existante, non expirée, compte actif. Mémorisée par requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(sessionCookie())?.value;
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, user: { select: { id: true, email: true, role: true, disabledAt: true, business: { select: { id: true } } } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.disabledAt) return null;
  const u = session.user;
  return { id: u.id, email: u.email, role: u.role, sessionId: session.id, businessId: u.business?.id ?? null };
});

/** Espace professionnel : session valide ET entreprise associée. */
export async function requirePro(): Promise<CurrentUser & { businessId: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.businessId) redirect(user.role === "ADMIN" ? "/admin" : "/connexion");
  return user as CurrentUser & { businessId: string };
}

/** Administration : rôle ADMIN vérifié en base à chaque requête. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role !== "ADMIN") redirect("/espace");
  return user;
}

/** Révoque toutes les sessions d'un compte (désactivation, changement de mot de passe). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
