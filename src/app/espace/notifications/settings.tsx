"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { BellRing, Mail, Smartphone, ShieldCheck, Loader2, Check, AlertTriangle, Trash2, Info, Send, PauseCircle } from "lucide-react";
import { clsx } from "clsx";
import { Card, CardHeader, Notice, Badge, buttonClass } from "@/components/ui";
import { dateFr } from "@/lib/format";
import { CHANNEL_INFO, EMAIL_MODES, type Channel, type EmailMode, type LogChannel, type NotifyPrefs } from "@/lib/notify/prefs";
import type { ActionResult } from "@/lib/action";
import { savePrefs, sendTest, savePushSubscription, removePushSubscription } from "./actions";

type Provider = { ready: boolean; provider: string; detail: string };
type PushState = "checking" | "unsupported" | "denied" | "ios-install" | "off" | "on" | "busy";

function b64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "PC Windows" : /Linux/.test(ua) ? "Linux" : "Appareil";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navigateur";
  return `${os} · ${br}`;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={clsx("relative h-7 w-12 flex-none rounded-full transition", on ? "bg-brand" : "bg-line")}>
      <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function NotifySettings({
  initial, defaultEmail, providers, vapidKey, devices, emailPaused, recent,
}: {
  initial: NotifyPrefs;
  defaultEmail: string;
  providers: Record<Channel, Provider>;
  vapidKey: string | null;
  devices: { id: string; label: string; endpoint: string; since: string; lastOk: string | null }[];
  /** Limite gratuite d'emails atteinte : envoi suspendu (push non concerné). */
  emailPaused: boolean;
  recent: { id: string; channel: string; status: string; createdAt: string; lastError: string; requestId: string }[];
}) {
  const [p, setP] = useState<NotifyPrefs>(initial);
  const [result, setResult] = useState<ActionResult>(null);
  const [saving, startSave] = useTransition();
  const [tests, setTests] = useState<Partial<Record<Channel, ActionResult | "pending">>>({});
  const [pushState, setPushState] = useState<PushState>("checking");
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<ActionResult>(null);
  const [host, setHost] = useState("ce site");
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);

  // État des notifications sur CET appareil (chaque téléphone / ordinateur s'active séparément).
  useEffect(() => {
    setHost(window.location.host);
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setPushState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setThisEndpoint(sub?.endpoint ?? null);
      setPushState(sub && devices.some((d) => d.endpoint === sub.endpoint) ? "on" : "off");
    })().catch(() => setPushState("unsupported"));
  }, [devices]);

  const enablePush = async () => {
    if (!vapidKey) return;
    setPushState("busy");
    setPushMsg(null);
    try {
      // Doit suivre directement le geste de l'utilisateur (exigence de Safari / iOS).
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription(json, deviceLabel());
      setPushMsg(res);
      setThisEndpoint(sub.endpoint);
      setPushState(res?.ok ? "on" : "off");
      if (res?.ok && !initial.push.on) {
        const next = { ...p, push: { on: true } };
        setP(next);
        setResult(await savePrefs(JSON.stringify(next)));
      }
    } catch (e) {
      setPushMsg({ ok: false, message: e instanceof Error ? e.message : "Activation impossible sur ce navigateur." });
      setPushState("off");
    }
  };

  const save = () => startSave(async () => setResult(await savePrefs(JSON.stringify(p))));

  const test = async (c: Channel) => {
    setTests((t) => ({ ...t, [c]: "pending" }));
    const res = await sendTest(c, c === "email" ? p.email.to || defaultEmail : "");
    setTests((t) => ({ ...t, [c]: res }));
  };
  const testLine = (c: Channel) => {
    const t = tests[c];
    if (!t) return null;
    if (t === "pending") return <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Envoi…</span>;
    return <span className={clsx("text-[13px]", t.ok ? "text-success" : "text-danger")}>{t.message}</span>;
  };
  const notReady = (c: Channel) =>
    providers[c].ready ? null : (
      <p className="mt-3 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
        <span>{c === "push" ? "Les notifications ne sont pas encore activées sur la plateforme. En attendant, l'email vous prévient." : "L'envoi d'emails n'est pas encore activé sur la plateforme. Vos demandes restent consultables dans « Demandes reçues »."}</span>
      </p>
    );
  const err = (k: string) => (result?.errors?.[k] ? <p className="mt-1 text-[12.5px] text-danger">{result.errors[k]}</p> : null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {/* ─── Canal principal : notification push ─── */}
        <Card className={clsx("p-5 transition sm:p-6", p.push.on && "ring-2 ring-brand/30")} data-channel="push">
          <div className="flex items-start gap-4">
            <span className={clsx("grid h-11 w-11 flex-none place-items-center rounded-xl", p.push.on ? "bg-brand text-white" : "bg-canvas text-muted")}><Smartphone className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15.5px] font-semibold">Notification sur mon téléphone</span>
                <Badge tone="info">Recommandé</Badge>
                {providers.push.ready ? <Badge tone="success">Gratuit · illimité</Badge> : <Badge tone="warn">Non configuré</Badge>}
              </div>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted">Une alerte s&apos;affiche en quelques secondes, même navigateur fermé. Touchez-la : la demande s&apos;ouvre avec le numéro du client.</p>
            </div>
            <Toggle on={p.push.on} label="Notifications sur l'appareil" onChange={(v) => setP((x) => ({ ...x, push: { on: v } }))} />
          </div>
          {p.push.on ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {pushState === "on" ? (
                <p className="flex items-center gap-2 text-[14px] text-success"><Check className="h-4 w-4" /> Activé sur cet appareil.</p>
              ) : pushState === "ios-install" ? (
                <Notice tone="warn">
                  <b>Sur iPhone et iPad</b> (iOS 16.4 ou plus) : ouvrez {host} dans <b>Safari</b>, touchez <b>Partager</b> puis <b>« Sur l&apos;écran d&apos;accueil »</b>. Ouvrez QR Pro depuis cette icône, revenez sur cette page et touchez « Activer ».
                </Notice>
              ) : pushState === "denied" ? (
                <Notice tone="warn">Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du site (icône du cadenas dans la barre d&apos;adresse, ou Réglages du téléphone), puis rechargez la page.</Notice>
              ) : pushState === "unsupported" ? (
                <Notice tone="warn">Ce navigateur ne permet pas les notifications. Utilisez Chrome, Edge, Firefox, Samsung Internet ou Safari récent.</Notice>
              ) : pushState === "checking" ? null : (
                <button type="button" onClick={enablePush} disabled={!vapidKey || pushState === "busy"} className={buttonClass("primary", "sm")} data-testid="enable-push">
                  {pushState === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Activer sur cet appareil
                </button>
              )}
              {pushMsg && !pushMsg.ok ? <p className="text-[13px] text-danger">{pushMsg.message}</p> : null}
              {devices.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {devices.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13.5px]">
                      <span className="min-w-0">
                        <span className="font-medium">{d.label}</span>
                        {d.endpoint === thisEndpoint ? <Badge tone="info" className="ml-2">Cet appareil</Badge> : null}
                        <span className="block text-[12px] text-muted">Ajouté le {dateFr(d.since)}{d.lastOk ? ` · dernière alerte ${dateFr(d.lastOk, true)}` : ""}</span>
                      </span>
                      <button type="button" onClick={async () => { await removePushSubscription(d.id); }} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Retirer ${d.label}`}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Activez-la sur chaque appareil où vous voulez être prévenu : votre téléphone, l&apos;ordinateur du bureau…</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => test("push")} disabled={!devices.length} className={buttonClass("secondary", "sm")}><Send className="h-3.5 w-3.5" /> Envoyer une notification d&apos;essai</button>
                {testLine("push")}
              </div>
              {notReady("push")}
            </div>
          ) : null}
        </Card>

        {/* ─── Complément : email ─── */}
        <Card className={clsx("p-5 transition sm:p-6", p.email.on && "ring-2 ring-brand/30")} data-channel="email">
          <div className="flex items-start gap-4">
            <span className={clsx("grid h-11 w-11 flex-none place-items-center rounded-xl", p.email.on ? "bg-brand text-white" : "bg-canvas text-muted")}><Mail className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15.5px] font-semibold">Email</span>
                {providers.email.ready ? <Badge tone="success">Gratuit</Badge> : <Badge tone="warn">Non configuré</Badge>}
                {emailPaused ? <Badge tone="warn">En pause</Badge> : null}
              </div>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted">Le détail complet : coordonnées, adresse, description, photos et documents (liens sécurisés valables 7 jours).</p>
            </div>
            <Toggle on={p.email.on} label="Notifications par email" onChange={(v) => setP((x) => ({ ...x, email: { ...x.email, on: v } }))} />
          </div>
          {p.email.on ? (
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <div role="radiogroup" aria-label="Quand envoyer l'email" className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(EMAIL_MODES) as EmailMode[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={p.email.mode === m} onClick={() => setP((x) => ({ ...x, email: { ...x.email, mode: m } }))} className={clsx("rounded-xl border px-3 py-2.5 text-left text-[13.5px] transition", p.email.mode === m ? "border-brand bg-brand-soft/60" : "border-line hover:bg-canvas")}>
                    <span className="font-medium">{EMAIL_MODES[m]}</span>
                    <span className="block text-[12px] text-muted">{m === "fallback" ? "Conseillé : pas de doublon avec la notification." : "Pour garder une trace écrite de chaque demande."}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor="email-to">Adresse de réception</label>
                  <input id="email-to" className="input" type="email" value={p.email.to} placeholder={defaultEmail} onChange={(e) => setP((x) => ({ ...x, email: { ...x.email, to: e.target.value } }))} />
                  {err("email.to")}
                </div>
                <button type="button" onClick={() => test("email")} className={buttonClass("secondary", "sm")}><Send className="h-3.5 w-3.5" /> Essai</button>
              </div>
              {testLine("email")}
              {emailPaused ? (
                <p className="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
                  <PauseCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>La limite gratuite d&apos;emails de la plateforme est atteinte : les emails reprennent automatiquement demain (ou le mois prochain). Vos demandes arrivent toujours ici et par notification sur votre téléphone.</span>
                </p>
              ) : null}
              {notReady("email")}
            </div>
          ) : null}
        </Card>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur">
          <button type="button" onClick={save} disabled={saving || !dirty} className={buttonClass("primary")} data-testid="save-prefs">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer mes préférences
          </button>
          {result ? <span className={clsx("text-[13.5px]", result.ok ? "text-success" : "text-danger")}>{result.message ?? (result.ok ? "" : "Vérifiez les champs signalés.")}</span> : dirty ? <span className="text-[13px] text-muted">Modifications non enregistrées</span> : null}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck className="h-4 w-4 text-success" /> Aucune demande perdue</div>
          <ul className="mt-3 space-y-2 text-[13px] leading-snug text-muted">
            <li>Chaque demande est enregistrée dans « Demandes reçues » <b>avant</b> tout envoi.</li>
            <li>Si la notification ne peut pas être remise (aucun appareil, appareil désabonné), un <b>email de secours</b> part automatiquement.</li>
            <li>Un envoi en échec est réessayé automatiquement, jusqu&apos;à 3 fois dans l&apos;heure. Jamais deux alertes pour la même demande.</li>
            <li>Notifications et emails sont gratuits : aucun abonnement, aucun SMS facturé.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <div className="text-[14px] font-semibold">Compatibilité</div>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-muted">
            <li><b>Ordinateur</b> : Chrome, Edge, Firefox, Safari (macOS 13+). Le navigateur doit être lancé (même en arrière-plan).</li>
            <li><b>Android</b> : Chrome, Edge, Firefox, Samsung Internet. Fonctionne téléphone en veille.</li>
            <li><b>iPhone / iPad</b> : iOS 16.4 ou plus, après ajout à l&apos;écran d&apos;accueil depuis Safari.</li>
            <li>Mode « Ne pas déranger » ou économie d&apos;énergie : l&apos;alerte peut être retardée ; la demande reste dans votre espace.</li>
          </ul>
        </Card>
        {recent.length ? (
          <Card>
            <CardHeader title="Derniers envois" />
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/espace/demandes/${r.requestId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] hover:bg-canvas">
                    <span>{CHANNEL_INFO[r.channel as LogChannel]?.label ?? r.channel}<span className="block text-[12px] text-muted">{dateFr(r.createdAt, true)}</span></span>
                    {r.status === "envoye" ? <Badge tone="success">Envoyé</Badge> : r.status === "echec" ? <span title={r.lastError}><Badge tone="danger"><AlertTriangle className="mr-1 inline h-3 w-3" />Échec</Badge></span> : <span title={r.lastError}><Badge>{r.status === "ignore" ? "Non envoyé" : "En attente"}</Badge></span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
