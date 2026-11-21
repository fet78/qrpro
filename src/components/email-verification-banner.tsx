"use client";

import { MailWarning } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form";
import { confirmEmailDev, resendVerification } from "@/app/espace/verification-actions";

/** Bandeau de l'espace pro tant que l'adresse email du compte n'est pas confirmée. */
export function EmailVerificationBanner({ email, devConfirm }: { email: string; devConfirm: boolean }) {
  return (
    <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3.5 text-[13.5px]" data-testid="email-unverified">
      <div className="flex items-start gap-2.5">
        <MailWarning className="mt-0.5 h-4 w-4 flex-none text-warn" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Confirmez votre adresse email</p>
          <p className="mt-0.5 text-muted">
            Un lien a été envoyé à <b className="break-all">{email}</b>. C&apos;est à cette adresse que partent vos factures et vos notifications ; la commande est possible une fois l&apos;adresse confirmée.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <ActionForm action={resendVerification}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Envoi…">Renvoyer le lien</SubmitButton>
            </ActionForm>
            {devConfirm ? (
              <ActionForm action={confirmEmailDev} showMessage={false}>
                <SubmitButton variant="ghost" size="sm" data-testid="dev-confirm-email">Confirmer (mode développement)</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
