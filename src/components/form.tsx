"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action";
import { buttonClass } from "./ui";

const Ctx = createContext<ActionResult>(null);

/**
 * Formulaire branché sur une action serveur : affiche le message de résultat et
 * les erreurs par champ (<FieldError name="…" />). Fonctionne aussi sans JavaScript.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  showMessage = true,
  onSuccess,
  ...rest
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showMessage?: boolean;
  onSuccess?: () => void;
} & Omit<ComponentProps<"form">, "action" | "children" | "className" | "onSubmit">) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <Ctx.Provider value={state}>
      <form ref={ref} action={formAction} className={className} noValidate {...rest}>
        {children}
        {showMessage ? <FormMessage /> : null}
      </form>
    </Ctx.Provider>
  );
}

export function FormMessage() {
  const state = useContext(Ctx);
  if (!state?.message) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={`mt-4 flex animate-fade-up items-start gap-2 rounded-lg px-3 py-2.5 text-[13.5px] ${state.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
    >
      {state.ok ? <CheckCircle2 className="mt-px h-4 w-4 flex-none" /> : <AlertCircle className="mt-px h-4 w-4 flex-none" />}
      <span>{state.message}</span>
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = useContext(Ctx);
  const msg = state?.errors?.[name];
  if (!msg) return null;
  return <p className="mt-1.5 text-[12.5px] text-danger">{msg}</p>;
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "dark"; size?: "sm" | "md" | "lg"; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, size, className)} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
