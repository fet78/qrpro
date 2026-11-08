"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { REQUEST_STATUS, STATUS_KEYS, type RequestStatus } from "@/lib/page/requests";
import { updateRequest } from "../actions";

/** Datetime-local (heure du navigateur) ↔ ISO avec fuseau : le rendez-vous est enregistré à l'heure exacte. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local}:00${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

export function ManageRequest({ id, status: initialStatus, scheduledAt, note }: { id: string; status: string; scheduledAt: string; note: string }) {
  const [status, setStatus] = useState<RequestStatus>((STATUS_KEYS as string[]).includes(initialStatus) ? (initialStatus as RequestStatus) : "nouvelle");
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  return (
    <ActionForm action={updateRequest} className="space-y-4 p-5 sm:p-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="scheduledAt" value={status === "planifiee" ? toIso(when) : ""} />
      <div role="radiogroup" aria-label="Statut" className="grid grid-cols-2 gap-2">
        {STATUS_KEYS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={clsx("rounded-lg border px-2 py-2 text-[13px] font-medium transition", status === s ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas", s === "annulee" && "col-span-2")}>
            {REQUEST_STATUS[s].label}
          </button>
        ))}
      </div>
      {status === "planifiee" ? (
        <div>
          <label className="label" htmlFor="when">Rendez-vous</label>
          <input id="when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
          <FieldError name="scheduledAt" />
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="note">Note interne</label>
        <textarea id="note" name="note" defaultValue={note} maxLength={2000} className="input min-h-[90px]" placeholder="Pièce à commander, accès, code portail… (visible par vous seul)" />
      </div>
      <FormMessage />
      <SubmitButton className="w-full">Enregistrer</SubmitButton>
    </ActionForm>
  );
}
