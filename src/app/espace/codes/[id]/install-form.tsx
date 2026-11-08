"use client";

import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { saveCode } from "../../actions";

interface Initial {
  id: string;
  label: string;
  equipment: string;
  brand: string;
  model: string;
  installedAt: string;
  lastServiceAt: string;
  nextServiceAt: string;
  publicNote: string;
  showInstall: boolean;
}

export function InstallForm({ initial }: { initial: Initial }) {
  return (
    <ActionForm action={saveCode} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      <input type="hidden" name="id" value={initial.id} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="label">Repère interne</label>
        <input className="input" id="label" name="label" defaultValue={initial.label} maxLength={80} placeholder="Ex. : M. Durand — 14 rue des Lilas" />
        <p className="hint">Visible uniquement par vous, pour retrouver l&apos;étiquette.</p>
        <FieldError name="label" />
      </div>
      <div>
        <label className="label" htmlFor="equipment">Équipement</label>
        <input className="input" id="equipment" name="equipment" defaultValue={initial.equipment} maxLength={80} placeholder="Chaudière gaz à condensation" />
        <FieldError name="equipment" />
      </div>
      <div>
        <label className="label" htmlFor="brand">Marque</label>
        <input className="input" id="brand" name="brand" defaultValue={initial.brand} maxLength={60} placeholder="Saunier Duval" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="model">Modèle / référence</label>
        <input className="input" id="model" name="model" defaultValue={initial.model} maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="installedAt">Date d&apos;installation</label>
        <input className="input" type="date" id="installedAt" name="installedAt" defaultValue={initial.installedAt} />
        <FieldError name="installedAt" />
      </div>
      <div>
        <label className="label" htmlFor="lastServiceAt">Dernier entretien</label>
        <input className="input" type="date" id="lastServiceAt" name="lastServiceAt" defaultValue={initial.lastServiceAt} />
        <FieldError name="lastServiceAt" />
      </div>
      <div>
        <label className="label" htmlFor="nextServiceAt">Prochain entretien conseillé</label>
        <input className="input" type="date" id="nextServiceAt" name="nextServiceAt" defaultValue={initial.nextServiceAt} />
        <FieldError name="nextServiceAt" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="publicNote">Note pour le client</label>
        <textarea className="input min-h-[90px]" id="publicNote" name="publicNote" defaultValue={initial.publicNote} maxLength={600} placeholder="Ex. : garantie pièces 5 ans, purger les radiateurs chaque automne…" />
        <FieldError name="publicNote" />
      </div>
      <label className="flex items-start gap-2.5 text-[14px] sm:col-span-2">
        <input type="checkbox" name="showInstall" defaultChecked={initial.showInstall} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
        <span>
          <span className="font-medium">Afficher ces informations</span> à la personne qui scanne cette étiquette
          <span className="block text-[13px] text-muted">Le repère interne n&apos;est jamais affiché.</span>
        </span>
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </ActionForm>
  );
}
