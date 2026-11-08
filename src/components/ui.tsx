import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition duration-150 focus-visible:outline-none focus-visible:shadow-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(29_78_216/0.35)] hover:bg-brand-strong",
  dark: "bg-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-ink/90",
  secondary: "border border-line bg-surface text-ink shadow-card hover:bg-canvas",
  ghost: "text-muted hover:bg-ink/[0.04] hover:text-ink",
  danger: "border border-danger/20 bg-surface text-danger hover:bg-danger-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(base, variants[variant], sizes[size], extra);
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("card", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-[13.5px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

const tones = {
  neutral: "bg-ink/[0.05] text-muted",
  info: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium", tones[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</div> : null}
      <div className="text-[15px] font-semibold">{title}</div>
      {description ? <p className="mt-1 max-w-sm text-[14px] text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, htmlFor, children, className }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "success" | "danger"; children: ReactNode; className?: string }) {
  const map = { info: "border-brand/15 bg-brand-soft text-ink", warn: "border-warn/20 bg-warn-soft text-ink", success: "border-success/20 bg-success-soft text-ink", danger: "border-danger/20 bg-danger-soft text-ink" };
  return <div className={clsx("rounded-xl border px-4 py-3 text-[14px] leading-relaxed", map[tone], className)}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div> : null}
    </div>
  );
}
