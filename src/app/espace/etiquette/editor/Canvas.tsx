"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Copy, Trash2, Lock, Unlock, BringToFront, SendToBack, PenLine } from "lucide-react";
import { keepsRatio } from "./Inspector";
import { FORMATS } from "@/lib/labels/formats";
import { MIN_QR_MM, SAFE_MM, type Element, type LabelDoc } from "@/lib/labels/doc";
import type { RenderedLabel } from "@/lib/labels/render";
import { labelSvg } from "@/lib/labels/svg";
import type { EditorApi } from "./store";

type Handle = "nw" | "ne" | "sw" | "se" | "e" | "w" | "n" | "s";
interface Drag {
  kind: "move" | Handle;
  id: string;
  startX: number;
  startY: number;
  box: { x: number; y: number; w: number; h: number };
  size?: number;
  before: LabelDoc;
  moved: boolean;
}
interface Guide {
  axis: "x" | "y";
  at: number;
}

/**
 * Plan de travail : rendu exact de l'étiquette (le même que le PDF) + calque d'interaction
 * (sélection, déplacement, poignées, guides magnétiques). Coordonnées du document en mm.
 */
export function Canvas({
  api, label, scale, logoHref, images, editingId, onEditText, onStopEdit, showSafe,
}: {
  api: EditorApi;
  label: RenderedLabel;
  scale: number;
  logoHref: string | null;
  images: Record<string, string>;
  /** Texte en cours d'édition directement sur l'étiquette. */
  editingId: string | null;
  onEditText: (id: string) => void;
  onStopEdit: () => void;
  showSafe: boolean;
}) {
  const { doc, selected } = api;
  const { w, h } = FORMATS[doc.format];
  const svg = useMemo(() => labelSvg(label, { logoHref, images, pxWidth: Math.round(w * scale) }), [label, logoHref, images, w, scale]);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const issueIds = new Set(label.issues.map((i) => i.elementId));

  const px = (mm: number) => mm * scale;

  /** Aimantation sur les bords, le centre, les marges et les autres éléments. */
  function snap(el: Element, box: { x: number; y: number; w: number; h: number }, edges: { x: boolean; y: boolean }) {
    const t = 6 / scale;
    const others = doc.elements.filter((e) => e.id !== el.id && !e.hidden);
    const xs = [0, SAFE_MM, w / 2, w - SAFE_MM, w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const ys = [0, SAFE_MM, h / 2, h - SAFE_MM, h, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
    const found: Guide[] = [];
    const out = { ...box };
    if (edges.x) {
      let best: { d: number; at: number } | null = null;
      for (const p of [box.x, box.x + box.w / 2, box.x + box.w]) for (const tx of xs) if (Math.abs(tx - p) < t && (!best || Math.abs(tx - p) < Math.abs(best.d))) best = { d: tx - p, at: tx };
      if (best) {
        out.x += best.d;
        found.push({ axis: "x", at: best.at });
      }
    }
    if (edges.y) {
      let best: { d: number; at: number } | null = null;
      for (const p of [box.y, box.y + box.h / 2, box.y + box.h]) for (const ty of ys) if (Math.abs(ty - p) < t && (!best || Math.abs(ty - p) < Math.abs(best.d))) best = { d: ty - p, at: ty };
      if (best) {
        out.y += best.d;
        found.push({ axis: "y", at: best.at });
      }
    }
    return { box: out, guides: found };
  }

  function start(e: React.PointerEvent, el: Element, kind: Drag["kind"]) {
    e.stopPropagation();
    e.preventDefault();
    api.select(el.id);
    if (el.locked) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, id: el.id, startX: e.clientX, startY: e.clientY, box: { x: el.x, y: el.y, w: el.w, h: el.h }, size: el.type === "text" ? el.size : undefined, before: doc, moved: false };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (!d.moved && Math.hypot(dx, dy) * scale < 2) return;
    if (!d.moved) setDragging(true);
    d.moved = true;
    const el = doc.elements.find((x) => x.id === d.id);
    if (!el) return;
    let b = { ...d.box };
    let patch: Partial<Element> = {};
    let g: Guide[] = [];
    if (d.kind === "move") {
      b.x += dx;
      b.y += dy;
      if (!e.altKey) ({ box: b, guides: g } = snap(el, b, { x: true, y: true }));
      patch = { x: b.x, y: b.y };
    } else {
      const k = d.kind;
      const locked = keepsRatio(el) || (el.type === "text" && k.length === 2);
      if (k.includes("e")) b.w = d.box.w + dx;
      if (k.includes("w")) {
        b.w = d.box.w - dx;
        b.x = d.box.x + dx;
      }
      if (k.includes("s")) b.h = d.box.h + dy;
      if (k.includes("n")) {
        b.h = d.box.h - dy;
        b.y = d.box.y + dy;
      }
      const min = el.type === "qr" ? MIN_QR_MM : 1;
      if (locked) {
        const ratio = d.box.h / d.box.w;
        const s = Math.max(min / Math.min(d.box.w, d.box.h), Math.abs(b.w - d.box.w) > Math.abs(b.h - d.box.h) ? b.w / d.box.w : b.h / d.box.h);
        b.w = d.box.w * s;
        b.h = d.box.w * s * ratio;
        if (k.includes("w")) b.x = d.box.x + d.box.w - b.w;
        if (k.includes("n")) b.y = d.box.y + d.box.h - b.h;
      }
      b.w = Math.max(min, b.w);
      b.h = Math.max(el.type === "shape" && el.shape === "line" ? 0.4 : min, b.h);
      patch = { x: b.x, y: b.y, w: b.w, h: b.h };
      if (el.type === "text" && locked && d.size) patch = { ...patch, size: Math.max(0.8, Math.min(30, d.size * (b.w / d.box.w))) } as Partial<Element>;
    }
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      api.update(d.id, patch, false);
      setGuides(g);
    });
  }

  function end() {
    const d = drag.current;
    drag.current = null;
    setGuides([]);
    setDragging(false);
    if (d?.moved) requestAnimationFrame(() => api.commit());
  }

  const sel = doc.elements.find((e) => e.id === selected && !e.hidden);
  const handles: Handle[] = sel ? (sel.type === "text" ? ["nw", "ne", "sw", "se", "e", "w"] : keepsRatio(sel) ? ["nw", "ne", "sw", "se"] : ["nw", "ne", "sw", "se", "e", "w", "n", "s"]) : [];
  const editing = doc.elements.find((e) => e.id === editingId && e.type === "text");
  const pos: Record<Handle, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize h-4 w-2",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize h-4 w-2",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize h-2 w-4",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize h-2 w-4",
  };

  return (
    <div
      className="relative touch-none select-none"
      style={{ width: px(w), height: px(h) }}
      onPointerDown={() => api.select(null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="label-svg pointer-events-none absolute inset-0 drop-shadow-[0_18px_40px_rgb(15_23_42/0.22)]" dangerouslySetInnerHTML={{ __html: svg }} />
      {showSafe ? (
        <div className="pointer-events-none absolute border border-dashed border-sky-500/60" style={{ left: px(SAFE_MM), top: px(SAFE_MM), width: px(w - 2 * SAFE_MM), height: px(h - 2 * SAFE_MM), borderRadius: px(Math.max(0, doc.corner - SAFE_MM)) }} />
      ) : null}

      {doc.elements.map((el) =>
        el.hidden ? null : (
          <div
            key={el.id}
            data-el={el.id}
            className={clsx("absolute", el.locked ? "cursor-default" : "cursor-move")}
            style={{ left: px(el.x), top: px(el.y), width: Math.max(px(el.w), 6), height: Math.max(px(el.h), 6), marginTop: px(el.h) < 6 ? (px(el.h) - 6) / 2 : 0 }}
            onPointerDown={(e) => start(e, el, "move")}
            onPointerEnter={() => setHover(el.id)}
            onPointerLeave={() => setHover((x) => (x === el.id ? null : x))}
            onDoubleClick={() => el.type === "text" && !el.locked && onEditText(el.id)}
            title={el.locked ? "Élément verrouillé" : undefined}
          >
            {hover === el.id && el.id !== selected ? <div className="pointer-events-none absolute inset-0 rounded-[2px] outline outline-1 outline-sky-400/80" /> : null}
            {issueIds.has(el.id) && el.id !== selected ? <span className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-amber-500" /> : null}
          </div>
        ),
      )}

      {sel ? (
        <div className="pointer-events-none absolute" style={{ left: px(sel.x), top: px(sel.y), width: px(sel.w), height: Math.max(px(sel.h), 2) }}>
          <div className={clsx("absolute inset-0 outline outline-[1.5px]", sel.type === "qr" ? "outline-emerald-500" : "outline-brand")} />
          {sel.type === "qr" ? (
            <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-emerald-600 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">QR protégé · {sel.w.toFixed(1)} mm</span>
          ) : dragging ? (
            <span className="absolute -bottom-6 left-0 whitespace-nowrap rounded bg-ink/85 px-1.5 py-0.5 text-[10.5px] font-medium text-white">{sel.w.toFixed(1)} × {sel.h.toFixed(1)} mm</span>
          ) : null}
          {!sel.locked
            ? handles.map((hd) => (
                <span
                  key={hd}
                  onPointerDown={(e) => start(e, sel, hd)}
                  className={clsx("pointer-events-auto absolute h-3 w-3 rounded-[3px] border-[1.5px] bg-white shadow-sm", sel.type === "qr" ? "border-emerald-500" : "border-brand", pos[hd])}
                />
              ))
            : null}
        </div>
      ) : null}

      {sel && !dragging && !editing && sel.type !== "qr" ? <Toolbar api={api} el={sel} px={px} onEditText={onEditText} labelW={px(w)} /> : null}

      {editing && editing.type === "text" ? <InlineText api={api} el={editing} px={px} scale={scale} onDone={onStopEdit} /> : null}

      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div key={i} className="pointer-events-none absolute top-[-12px] bottom-[-12px] w-px bg-fuchsia-500" style={{ left: px(g.at) }} />
        ) : (
          <div key={i} className="pointer-events-none absolute left-[-12px] right-[-12px] h-px bg-fuchsia-500" style={{ top: px(g.at) }} />
        ),
      )}
    </div>
  );
}

/** Barre d'actions flottante au-dessus de l'élément sélectionné (comme dans les éditeurs graphiques). */
function Toolbar({ api, el, px, onEditText, labelW }: { api: EditorApi; el: Element; px: (mm: number) => number; onEditText: (id: string) => void; labelW: number }) {
  const top = px(el.y) >= 14 ? px(el.y) - 46 : px(el.y + el.h) + 30;
  const center = Math.min(Math.max(px(el.x + el.w / 2), 110), Math.max(110, labelW - 110));
  const btn = "grid h-8 w-8 place-items-center rounded-md text-ink/80 transition hover:bg-ink/[0.07] hover:text-ink";
  return (
    <div
      className="absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-surface p-1 shadow-lift ring-1 ring-line"
      style={{ left: center, top }}
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Actions sur l'élément"
    >
      {el.type === "text" && !el.locked ? (
        <button type="button" className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-brand hover:bg-brand-soft" onClick={() => onEditText(el.id)}>
          <PenLine className="h-3.5 w-3.5" /> Modifier
        </button>
      ) : null}
      <button type="button" className={btn} title="Dupliquer (Ctrl+D)" aria-label="Dupliquer" onClick={() => api.duplicate(el.id)}><Copy className="h-4 w-4" /></button>
      <button type="button" className={btn} title="Mettre devant" aria-label="Mettre devant" onClick={() => api.reorder(el.id, "front")}><BringToFront className="h-4 w-4" /></button>
      <button type="button" className={btn} title="Mettre derrière" aria-label="Mettre derrière" onClick={() => api.reorder(el.id, "back")}><SendToBack className="h-4 w-4" /></button>
      <button type="button" className={clsx(btn, el.locked && "text-brand")} title={el.locked ? "Déverrouiller" : "Verrouiller"} aria-label={el.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => api.update(el.id, { locked: !el.locked })}>
        {el.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </button>
      <span className="mx-0.5 h-5 w-px bg-line" />
      <button type="button" className={clsx(btn, "hover:bg-danger-soft hover:text-danger")} title="Supprimer (Suppr)" aria-label="Supprimer" onClick={() => api.remove(el.id)}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

/** Édition du texte directement sur l'étiquette (le rendu exact se met à jour en dessous). */
function InlineText({ api, el, px, scale, onDone }: { api: EditorApi; el: Element & { type: "text" }; px: (mm: number) => number; scale: number; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = () => {
    api.commit();
    onDone();
  };
  return (
    <textarea
      ref={ref}
      value={el.text}
      maxLength={160}
      aria-label="Modifier le texte"
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => api.update(el.id, { text: e.target.value }, false)}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          finish();
        }
      }}
      className="absolute z-30 resize-none rounded-md border-0 bg-white/95 p-1.5 leading-snug text-ink shadow-lift outline-none ring-2 ring-brand"
      style={{ left: px(el.x) - 4, top: px(el.y + el.h) + 6, width: Math.max(220, px(el.w) + 8), height: 76, fontSize: Math.min(18, Math.max(13, el.size * scale * 0.55)) }}
    />
  );
}
