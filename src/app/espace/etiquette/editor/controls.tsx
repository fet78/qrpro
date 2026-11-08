"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";
import { PALETTE_ROLES, ROLE_LABELS, HEX_RE, resolveColor, type Palette } from "@/lib/labels/doc";

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Champ numérique (mm) qui ne pousse la valeur qu'à la validation (Entrée ou sortie du champ). */
export function NumberField({ value, onChange, step = 0.5, min, max, suffix = "mm", label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; label: string }) {
  const [text, setText] = useState(value.toFixed(1));
  useEffect(() => setText(value.toFixed(1)), [value]);
  const commit = () => {
    const v = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(v)) return setText(value.toFixed(1));
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
  };
  return (
    <label className="flex h-8 items-center rounded-md border border-line bg-surface pl-2 text-[12.5px] focus-within:border-brand/60 focus-within:shadow-ring">
      <span className="mr-1.5 w-3 text-faint">{label}</span>
      <input
        className="w-12 bg-transparent tabular-nums outline-none"
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 4 : 1))));
          }
        }}
      />
      <span className="pr-2 text-faint">{suffix}</span>
    </label>
  );
}

export function Slider({ value, onChange, onCommit, min, max, step, format }: { value: number; onChange: (v: number) => void; onCommit?: () => void; min: number; max: number; step: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-1.5 w-full cursor-pointer accent-[rgb(var(--brand))]"
      />
      <span className="w-14 text-right text-[12px] tabular-nums text-muted">{format ? format(value) : value}</span>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-label={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("grid h-7 min-w-7 place-items-center rounded-md px-2 text-[12.5px] transition", value === o.value ? "bg-surface font-semibold text-ink shadow-card" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NEUTRALS = ["#FFFFFF", "#F3F4F6", "#9CA3AF", "#4B5563", "#111111", "#000000"];

/**
 * Couleur : rôles de la palette (le design suit les changements d'harmonie) ou couleur libre.
 * `allowNone` : propose « aucune » (contour ou fond transparent).
 */
export function ColorField({ value, palette, onChange, allowNone }: { value: string | undefined; palette: Palette; onChange: (v: string) => void; allowNone?: boolean }) {
  const current = resolveColor(value, palette);
  const swatch = (v: string, color: string | null, title: string) => (
    <button
      key={v}
      type="button"
      title={title}
      aria-label={title}
      onClick={() => onChange(v)}
      className={clsx("relative h-7 w-7 rounded-full ring-1 ring-black/10 transition hover:scale-110", value === v && "ring-2 ring-brand ring-offset-2")}
      style={color ? { background: color } : { background: "repeating-linear-gradient(45deg,#fff 0 4px,#E5E7EB 4px 8px)" }}
    >
      {value === v ? <Check className={clsx("absolute inset-0 m-auto h-3.5 w-3.5", color && contrastWhite(color) ? "text-white" : "text-ink")} /> : null}
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PALETTE_ROLES.map((r) => swatch(`$${r}`, palette[r], `${ROLE_LABELS[r]} (palette)`))}
        {allowNone ? swatch("none", null, "Aucune") : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {NEUTRALS.map((c) => swatch(c, c, c))}
        <label className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-black/10" title="Couleur personnalisée" style={{ background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" }}>
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={current ?? "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Couleur personnalisée" />
        </label>
        {value && HEX_RE.test(value) && !NEUTRALS.includes(value) ? <span className="text-[11.5px] font-mono text-muted">{value}</span> : null}
      </div>
    </div>
  );
}

function contrastWhite(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.6;
}

export function IconButton({ title, onClick, children, active, disabled, danger }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "grid h-8 w-8 place-items-center rounded-md transition disabled:opacity-35",
        active ? "bg-brand-soft text-brand" : danger ? "text-muted hover:bg-danger-soft hover:text-danger" : "text-muted hover:bg-ink/[0.06] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
