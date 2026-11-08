import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader } from "@/components/ui";
import { parsePrefs } from "@/lib/notify/prefs";
import { emailStatus, pushStatus, vapidPublicKey } from "@/server/notify/providers";
import { emailUsage } from "@/server/email-quota";
import { NotifySettings } from "./settings";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePro();
  const [b, subs, recent, usage] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { notify: true, email: true } }),
    db.pushSubscription.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" }, select: { id: true, label: true, endpoint: true, createdAt: true, lastOkAt: true } }),
    db.notificationLog.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, channel: true, status: true, createdAt: true, lastError: true, requestId: true } }),
    emailUsage(),
  ]);
  return (
    <>
      <PageHeader
        title="Notifications et préférences de contact"
        description="Soyez prévenu à chaque nouvelle demande. La notification sur votre téléphone est instantanée et gratuite ; l'email la complète."
      />
      <NotifySettings
        initial={parsePrefs(b.notify)}
        defaultEmail={b.email || user.email}
        providers={{ email: emailStatus(), push: pushStatus() }}
        vapidKey={vapidPublicKey()}
        devices={subs.map((x) => ({ id: x.id, label: x.label || "Appareil", endpoint: x.endpoint, since: x.createdAt.toISOString(), lastOk: x.lastOkAt?.toISOString() ?? null }))}
        emailPaused={usage.notificationsBlocked}
        recent={recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </>
  );
}
