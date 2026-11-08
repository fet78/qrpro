"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Camera, X, Wrench, FileText, Siren, MessageSquare, Phone, MapPin, FileUp, Clock } from "lucide-react";
import { clsx } from "clsx";
import { requestIntervention, type RequestResult } from "@/app/p/actions";
import { AVAILABILITY_SLOTS, FORM_KINDS, MAX_FILES, MAX_PDF_BYTES, MAX_PHOTO_BYTES, MAX_TOTAL_BYTES, sizeLabel, type FormKind } from "@/lib/page/requests";
import { phoneFr, telHref } from "@/lib/format";

const KIND_UI: Record<FormKind, { label: string; hint: string; icon: typeof Wrench; hash: string }> = {
  intervention: { label: "Intervention", hint: "Panne, entretien, réparation", icon: Wrench, hash: "demande" },
  devis: { label: "Devis", hint: "Projet, installation", icon: FileText, hash: "devis" },
  urgence: { label: "Urgence", hint: "Fuite, plus de chauffage", icon: Siren, hash: "urgence" },
  contact: { label: "Message", hint: "Une simple question", icon: MessageSquare, hash: "message" },
};
const HASH_TO_KIND: Record<string, FormKind> = { demande: "intervention", devis: "devis", urgence: "urgence", message: "contact" };
const URGENCY = [
  { key: "urgent", label: "Aujourd'hui" },
  { key: "rapide", label: "Sous 48 h" },
  { key: "flexible", label: "Pas pressé" },
] as const;
const CONTACT = [
  { key: "appel", label: "Appel" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
] as const;

export interface RequestFormConfig {
  types: FormKind[];
  problems: string[];
  address: "off" | "optional" | "required";
  availability: boolean;
  files: boolean;
  intro: string;
}

type Attachment = { blob: Blob; name: string; url: string | null; pdf: boolean };
type Suggestion = { label: string; street: string; postcode: string; city: string };

/**
 * Photo réduite à 1600 px et recompressée en JPEG dans le navigateur (envoi rapide en 4G).
 * Si elle reste lourde (photo très détaillée), la qualité baisse par paliers jusqu'à passer sous 1 Mo.
 */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image"));
      i.src = url;
    });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const encode = (q: number) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("jpeg"))), "image/jpeg", q));
    let blob = await encode(0.8);
    for (const q of [0.7, 0.6, 0.5]) {
      if (blob.size <= 1024 * 1024) break;
      blob = await encode(q);
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Formulaire de demande (page publique). Pensé pour le téléphone : un choix en haut, des puces plutôt
 * que du texte à taper, l'adresse complétée automatiquement (Base Adresse Nationale, sans clé),
 * photos prises directement avec l'appareil. Chaque envoi porte une clé unique : un double envoi
 * ne crée jamais deux demandes.
 */
export function RequestForm({
  slug, code, preview, businessName, phone, dark = false, config,
}: {
  slug: string;
  code: string | null;
  preview: boolean;
  businessName: string;
  phone: string;
  dark?: boolean;
  config: RequestFormConfig;
}) {
  const types = config.types.length ? config.types : [...FORM_KINDS];
  const [state, setState] = useState<RequestResult>(null);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<FormKind>(types[0]!);
  const [problem, setProblem] = useState("");
  const [urgency, setUrgency] = useState<string>("rapide");
  const [contact, setContact] = useState<string>("appel");
  const [slots, setSlots] = useState<string[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState("");
  const [address, setAddress] = useState({ street: "", postcode: "", city: "" });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string | null>(null);

  // Les boutons de la page (#devis, #urgence, #message…) ouvrent le formulaire sur le bon type.
  useEffect(() => {
    const apply = () => {
      const k = HASH_TO_KIND[window.location.hash.slice(1)];
      if (k && types.includes(k)) {
        setKind(k);
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [types.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saisie d'adresse assistée (api-adresse.data.gouv.fr, service public gratuit).
  useEffect(() => {
    const q = address.street.trim();
    if (q.length < 5 || preview) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=4&type=housenumber&autocomplete=1`, { signal: ctrl.signal });
        const json = (await res.json()) as { features?: { properties: { label: string; name: string; postcode: string; city: string } }[] };
        setSuggestions((json.features ?? []).map((f) => ({ label: f.properties.label, street: f.properties.name, postcode: f.properties.postcode, city: f.properties.city })));
      } catch {
        /* hors ligne ou service indisponible : saisie manuelle */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [address.street, preview]);

  const muted = dark ? "text-white/60" : "text-black/55";
  const field = clsx(
    "block w-full rounded-xl border px-3.5 py-3 text-[16px] outline-none transition",
    dark ? "border-white/15 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-white/40" : "border-black/10 bg-white placeholder:text-black/35 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]",
  );
  const chip = (active: boolean, danger = false) =>
    clsx("rounded-full px-3.5 py-2 text-[14px] font-medium ring-1 transition", active ? "text-white ring-transparent" : dark ? "text-white/80 ring-white/15 hover:bg-white/5" : "text-black/70 ring-black/10 hover:bg-black/[0.03]", danger && active && "!bg-red-600");
  const label = (t: string, opt?: string) => (
    <div className={clsx("mb-2 text-[13.5px] font-semibold", dark ? "text-white/80" : "text-black/70")}>
      {t} {opt ? <span className={clsx("font-normal", muted)}>({opt})</span> : null}
    </div>
  );
  const err = (k: string) => (state?.errors?.[k] ? <p className="mt-1 text-[13px] text-red-500">{state.errors[k]}</p> : null);

  if (state?.ok) {
    return (
      <div id="demande" className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <p className="mt-3 text-[18px] font-semibold">{kind === "contact" ? "Message envoyé" : "Demande envoyée"}</p>
        <p className={clsx("mt-1 max-w-xs text-[14.5px]", muted)}>
          {businessName} vient d&apos;être prévenu et vous recontactera {contact === "sms" ? "par SMS" : contact === "email" ? "par email" : contact === "whatsapp" ? "sur WhatsApp" : "par téléphone"}.
        </p>
        {state.ref ? <p className={clsx("mt-3 rounded-full px-3 py-1 text-[12.5px] font-medium", dark ? "bg-white/10" : "bg-black/5")}>Référence {state.ref}</p> : null}
        {kind === "urgence" && phone ? (
          <a href={telHref(phone)} className="mt-5 flex h-12 items-center gap-2 rounded-xl bg-red-600 px-5 text-[15px] font-semibold text-white"><Phone className="h-4 w-4" /> Appeler maintenant</a>
        ) : null}
      </div>
    );
  }

  const isContact = kind === "contact";
  const showAddress = !isContact && config.address !== "off" && kind !== "devis" ? true : kind === "devis" && config.address !== "off";
  const addressRequired = (kind === "intervention" || kind === "urgence") && config.address === "required";
  const showProblems = !isContact && config.problems.length > 0;

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    keyRef.current ??= typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-req`;
    fd.set("clientKey", keyRef.current);
    fd.set("kind", kind);
    fd.set("problem", showProblems ? problem : "");
    fd.set("urgency", kind === "intervention" ? urgency : kind === "urgence" ? "urgent" : "flexible");
    fd.set("contactPref", contact);
    fd.delete("slots");
    if (config.availability && !isContact) slots.forEach((s) => fd.append("slots", s));
    files.forEach((f, i) => fd.append("files", new File([f.blob], f.pdf ? f.name : `photo-${i + 1}.jpg`, { type: f.pdf ? "application/pdf" : "image/jpeg" })));
    start(async () => {
      try {
        setState(await requestIntervention(null, fd));
      } catch {
        // Requête refusée avant d'atteindre le serveur (connexion coupée, envoi trop lourd pour l'hébergeur).
        setState({ ok: false, message: files.length ? "L'envoi n'a pas abouti : connexion interrompue ou pièces jointes trop lourdes. Retirez un fichier ou réessayez." : "L'envoi n'a pas abouti : vérifiez votre connexion et réessayez." });
      }
    });
  };

  const usedBytes = files.reduce((n, f) => n + f.blob.size, 0);

  /** Ajout de fichiers : chaque refus est expliqué (type, taille du fichier, total de la demande). */
  const addFiles = async (list: FileList | null, pdf: boolean) => {
    if (!list) return;
    setFileError("");
    let used = usedBytes;
    let count = files.length;
    for (const file of Array.from(list)) {
      if (count >= MAX_FILES) {
        setFileError(`${MAX_FILES} fichiers maximum par demande.`);
        break;
      }
      try {
        let item: Attachment;
        if (pdf) {
          if (file.type !== "application/pdf") throw new Error("Seuls les documents PDF sont acceptés.");
          if (file.size > MAX_PDF_BYTES) throw new Error(`« ${file.name.slice(0, 40)} » pèse ${sizeLabel(file.size)} : ${sizeLabel(MAX_PDF_BYTES)} maximum par document. Envoyez une version allégée ou une photo de la page utile.`);
          item = { blob: file, name: file.name, url: null, pdf: true };
        } else {
          const blob = await shrink(file);
          if (blob.size > MAX_PHOTO_BYTES) throw new Error("Cette photo reste trop lourde même réduite. Essayez une autre photo.");
          item = { blob, name: file.name, url: URL.createObjectURL(blob), pdf: false };
        }
        if (used + item.blob.size > MAX_TOTAL_BYTES) {
          if (item.url) URL.revokeObjectURL(item.url);
          throw new Error(`Limite atteinte : ${sizeLabel(MAX_TOTAL_BYTES)} de pièces jointes par demande (${sizeLabel(used)} déjà ajoutés). Retirez un fichier pour en ajouter un autre.`);
        }
        used += item.blob.size;
        count++;
        setFiles((fs) => [...fs, item].slice(0, MAX_FILES));
      } catch (e) {
        setFileError(e instanceof Error && e.message.length > 12 ? e.message : "Ce fichier n'a pas pu être lu.");
      }
    }
  };

  return (
    <div ref={rootRef} className="scroll-mt-6">
      {/* Ancres des boutons de la page */}
      {Object.values(KIND_UI).map((k) => <span key={k.hash} id={k.hash === "demande" ? undefined : k.hash} className="block scroll-mt-6" />)}
      <form
        id="demande"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!preview) submit(e.currentTarget);
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="code" value={code ?? ""} />
        <div aria-hidden className="absolute left-[-9999px] h-0 overflow-hidden">
          <label>Ne pas remplir<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
        </div>
        {config.intro ? <p className={clsx("text-[14.5px] leading-relaxed", muted)}>{config.intro}</p> : null}

        {types.length > 1 ? (
          <div role="radiogroup" aria-label="Type de demande" className={clsx("grid gap-2", types.length === 4 ? "grid-cols-2" : types.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {types.map((k) => {
              const u = KIND_UI[k];
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-kind={k}
                  onClick={() => setKind(k)}
                  className={clsx("flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left ring-1 transition", on ? "text-white ring-transparent" : dark ? "ring-white/15 text-white/85" : "ring-black/10 text-black/80")}
                  style={on ? { background: k === "urgence" ? "#DC2626" : "var(--accent)" } : undefined}
                >
                  <u.icon className="h-5 w-5 flex-none" />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold leading-tight">{u.label}</span>
                    <span className={clsx("block truncate text-[12px] leading-tight", on ? "text-white/80" : muted)}>{u.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {kind === "urgence" && phone ? (
          <div className="rounded-2xl bg-red-600 p-4 text-white">
            <p className="text-[14.5px] font-semibold">Urgence : le plus rapide est d&apos;appeler.</p>
            <a href={telHref(phone)} className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-[15.5px] font-semibold text-red-700"><Phone className="h-4 w-4" /> Appeler le {phoneFr(phone)}</a>
            <p className="mt-2.5 text-[12.5px] text-white/85">Pas de réponse ? Envoyez le formulaire ci-dessous : votre demande est signalée comme urgente.</p>
          </div>
        ) : null}

        {showProblems ? (
          <div>
            {label(kind === "devis" ? "Votre projet" : "Le problème")}
            <div className="flex flex-wrap gap-2">
              {config.problems.map((p) => (
                <button key={p} type="button" onClick={() => setProblem((x) => (x === p ? "" : p))} aria-pressed={problem === p} className={chip(problem === p)} style={problem === p ? { background: "var(--accent)" } : undefined}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          {label(isContact ? "Votre message" : "Décrivez la situation")}
          <textarea
            className={clsx(field, "min-h-[110px] resize-y")}
            name="message"
            placeholder={isContact ? "Votre question" : kind === "devis" ? "Équipement souhaité, surface, délais, budget…" : "Depuis quand ? Code erreur affiché, bruit, fuite… Plus c'est précis, mieux c'est préparé."}
          />
          {err("message")}
        </div>

        {kind === "intervention" ? (
          <div>
            {label("Délai souhaité")}
            <div className="flex flex-wrap gap-2">
              {URGENCY.map((u) => (
                <button key={u.key} type="button" onClick={() => setUrgency(u.key)} aria-pressed={urgency === u.key} className={chip(urgency === u.key, u.key === "urgent")} style={urgency === u.key ? { background: "var(--accent)" } : undefined}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showAddress ? (
          <div className="relative">
            {label(kind === "devis" ? "Adresse du chantier" : "Adresse de l'intervention", addressRequired ? undefined : "facultatif")}
            <div className="relative">
              <MapPin className={clsx("pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", muted)} />
              <input
                className={clsx(field, "pl-10")}
                name="address"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                placeholder="N° et rue"
                autoComplete="street-address"
                aria-label="Adresse"
              />
            </div>
            {suggestions.length ? (
              <ul className={clsx("absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-xl shadow-lg ring-1", dark ? "bg-neutral-900 ring-white/15" : "bg-white ring-black/10")} role="listbox">
                {suggestions.map((s) => (
                  <li key={s.label}>
                    <button
                      type="button"
                      className={clsx("block w-full px-3.5 py-2.5 text-left text-[14px]", dark ? "hover:bg-white/10" : "hover:bg-black/[0.04]")}
                      onClick={() => {
                        setAddress({ street: s.street, postcode: s.postcode, city: s.city });
                        setSuggestions([]);
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 grid grid-cols-[132px_1fr] gap-2">
              <input className={field} name="postalCode" value={address.postcode} onChange={(e) => setAddress((a) => ({ ...a, postcode: e.target.value.replace(/\D/g, "").slice(0, 5) }))} placeholder="Code postal" inputMode="numeric" autoComplete="postal-code" aria-label="Code postal" />
              <input className={field} name="city" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} placeholder="Ville" autoComplete="address-level2" aria-label="Ville" />
            </div>
            {err("address")}
            {err("postalCode")}
          </div>
        ) : null}

        {config.availability && !isContact ? (
          <div>
            {label("Vos disponibilités", "facultatif")}
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_SLOTS.map((s) => {
                const on = slots.includes(s);
                return (
                  <button key={s} type="button" onClick={() => setSlots((xs) => (on ? xs.filter((x) => x !== s) : [...xs, s]))} aria-pressed={on} className={chip(on)} style={on ? { background: "var(--accent)" } : undefined}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="relative mt-2">
              <Clock className={clsx("pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", muted)} />
              <input className={clsx(field, "pl-10")} name="availabilityNote" maxLength={160} placeholder="Précision : « après 17 h », « sauf mercredi »…" aria-label="Précision sur vos disponibilités" />
            </div>
          </div>
        ) : null}

        {config.files && !isContact ? (
          <div>
            {label("Photos ou documents", "facultatif")}
            <div className="flex flex-wrap items-center gap-2">
              {files.map((f, i) => (
                <span key={i} className={clsx("relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl ring-1", dark ? "ring-white/15" : "ring-black/10")}>
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center px-1 text-center text-[10.5px] leading-tight"><FileText className="mb-1 h-5 w-5" />{f.name.slice(0, 14)}</span>
                  )}
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white" aria-label="Retirer"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              {files.length < MAX_FILES ? (
                <>
                  <button type="button" onClick={() => photoRef.current?.click()} className={clsx("flex h-[72px] items-center gap-2 rounded-xl border border-dashed px-4 text-[13.5px] font-medium", dark ? "border-white/25 text-white/85" : "border-black/20 text-black/70")}>
                    <Camera className="h-5 w-5" /> Photo
                  </button>
                  <button type="button" onClick={() => docRef.current?.click()} className={clsx("flex h-[72px] items-center gap-2 rounded-xl border border-dashed px-4 text-[13.5px] font-medium", dark ? "border-white/25 text-white/85" : "border-black/20 text-black/70")}>
                    <FileUp className="h-5 w-5" /> PDF
                  </button>
                </>
              ) : null}
            </div>
            <p className={clsx("mt-1.5 text-[12.5px]", muted)}>Une photo de l&apos;appareil, de la plaque signalétique ou du code erreur fait gagner du temps. {MAX_FILES} fichiers et {sizeLabel(MAX_TOTAL_BYTES)} maximum (PDF : {sizeLabel(MAX_PDF_BYTES)} chacun){files.length ? ` · ${sizeLabel(usedBytes)} utilisés` : ""}.</p>
            {fileError ? <p className="mt-1 text-[13px] text-red-500">{fileError}</p> : null}
            <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { const l = e.target.files; await addFiles(l, false); e.target.value = ""; }} data-testid="request-photo-input" />
            <input ref={docRef} type="file" accept="application/pdf" className="hidden" onChange={async (e) => { const l = e.target.files; await addFiles(l, true); e.target.value = ""; }} data-testid="request-pdf-input" />
          </div>
        ) : null}

        <div className="space-y-2.5">
          {label("Vos coordonnées")}
          <div>
            <input className={field} name="name" placeholder="Nom et prénom" autoComplete="name" required />
            {err("name")}
          </div>
          <div>
            <input className={field} name="phone" type="tel" placeholder="Téléphone" autoComplete="tel" inputMode="tel" required />
            {err("phone")}
          </div>
          <div>
            <input className={field} name="email" type="email" placeholder="Email (facultatif)" autoComplete="email" />
            {err("email")}
          </div>
        </div>

        <div>
          {label("Être recontacté par")}
          <div className="flex flex-wrap gap-2">
            {CONTACT.map((c) => (
              <button key={c.key} type="button" onClick={() => setContact(c.key)} aria-pressed={contact === c.key} className={chip(contact === c.key)} style={contact === c.key ? { background: "var(--accent)" } : undefined}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <p className={clsx("text-[12px] leading-relaxed", dark ? "text-white/45" : "text-black/45")}>
          Vos informations et fichiers sont transmis uniquement à {businessName || "l'entreprise"} pour traiter votre demande.
        </p>
        {state?.message && !state.ok ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13.5px] text-red-600">{state.message}</p> : null}
        {preview ? <p className={clsx("rounded-lg px-3 py-2 text-[13px]", dark ? "bg-white/5 text-white/60" : "bg-black/5 text-black/55")}>Aperçu : l&apos;envoi est désactivé.</p> : null}
        <button
          type="submit"
          disabled={pending || preview}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold text-white transition disabled:opacity-60"
          style={{ background: kind === "urgence" ? "#DC2626" : "var(--accent)" }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {kind === "contact" ? "Envoyer mon message" : kind === "devis" ? "Demander mon devis" : kind === "urgence" ? "Envoyer ma demande urgente" : "Envoyer ma demande"}
        </button>
      </form>
    </div>
  );
}
