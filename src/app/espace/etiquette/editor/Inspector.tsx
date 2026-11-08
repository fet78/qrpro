"use client";

import { useEffect, useRef } from "react";
import {
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  ArrowUp, ArrowDown, Copy, Trash2, Lock, Unlock, ShieldCheck, Bold, CaseUpper, BringToFront, SendToBack,
} from "lucide-react";
import { clsx } from "clsx";
import { FORMATS, FORMAT_KEYS, type FormatKey } from "@/lib/labels/formats";
import {
  FONTS, FONT_KEYS, VARIABLES, MIN_QR_MM, SAFE_MM, PALETTE_ROLES, ROLE_LABELS,
  type Element, type FontKey, type FontRef, type LabelDoc, type TextEl, type ShapeEl, type IconEl, type QrEl, type GraphicEl, type ImageEl,
} from "@/lib/labels/doc";
import { GRAPHICS } from "@/lib/labels/graphics";
import { GraphicThumb } from "./Assets";
import { ICONS } from "@/lib/labels/icons";
import { Section, Row, NumberField, Slider, Segmented, ColorField, IconButton } from "./controls";
import type { EditorApi } from "./store";

const MM_TO_PT = 72 / 25.4;

export function Inspector({ api, onFormat, editTextNonce, hasLogo, onReplaceImage }: { api: EditorApi; onFormat: (f: FormatKey) => void; editTextNonce: number; hasLogo: boolean; onReplaceImage: () => void }) {
  const el = api.selectedEl;
  if (!el) return <LabelSettings api={api} onFormat={onFormat} />;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-[13.5px] font-semibold">{TYPE_LABEL[el.type]}</div>
        <div className="flex items-center">
          {el.type !== "qr" ? (
            <>
              <IconButton title="Dupliquer (Ctrl+D)" onClick={() => api.duplicate(el.id)}><Copy className="h-4 w-4" /></IconButton>
              <IconButton title={el.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => api.update(el.id, { locked: !el.locked })} active={el.locked}>{el.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</IconButton>
              <IconButton title="Supprimer (Suppr)" onClick={() => api.remove(el.id)} danger><Trash2 className="h-4 w-4" /></IconButton>
            </>
          ) : null}
        </div>
      </div>
      {el.type === "text" ? <TextProps api={api} el={el} editTextNonce={editTextNonce} /> : null}
      {el.type === "shape" ? <ShapeProps api={api} el={el} /> : null}
      {el.type === "icon" ? <IconProps api={api} el={el} /> : null}
      {el.type === "logo" ? (
        <Section title="Logo">
          <p className="text-[13px] leading-relaxed text-muted">{hasLogo ? "Votre logo s'ajuste dans ce cadre sans être déformé." : "Vous n'avez pas encore de logo : ajoutez-le dans « Ma page »."}</p>
          <OpacityRow api={api} el={el} />
        </Section>
      ) : null}
      {el.type === "graphic" ? <GraphicProps api={api} el={el} /> : null}
      {el.type === "image" ? <ImageProps api={api} el={el} onReplace={onReplaceImage} /> : null}
      {el.type === "qr" ? <QrProps api={api} el={el} /> : null}
      <Geometry api={api} el={el} />
      {el.type !== "qr" ? <Arrange api={api} el={el} /> : null}
    </div>
  );
}

const TYPE_LABEL: Record<Element["type"], string> = { text: "Texte", shape: "Forme", icon: "Icône", logo: "Logo", graphic: "Graphisme", image: "Image", qr: "QR code" };

/** Éléments redimensionnés sans déformation. */
export function keepsRatio(el: Element): boolean {
  if (el.type === "qr" || el.type === "icon" || el.type === "logo") return true;
  if (el.type === "graphic") {
    const g = GRAPHICS[el.graphic];
    return !!g && g.kind === "art" && !g.stretch;
  }
  return false;
}

function OpacityRow({ api, el }: { api: EditorApi; el: Element }) {
  return (
    <div>
      <span className="text-[13px] text-muted">Opacité</span>
      <Slider value={el.opacity ?? 1} min={0.1} max={1} step={0.05} onChange={(v) => api.update(el.id, { opacity: v }, false)} onCommit={() => api.commit()} format={(v) => `${Math.round(v * 100)} %`} />
    </div>
  );
}

function TextProps({ api, el, editTextNonce }: { api: EditorApi; el: TextEl; editTextNonce: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const doc = api.doc;
  useEffect(() => {
    if (editTextNonce) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editTextNonce]);
  const insert = (token: string) => {
    const t = ref.current;
    const start = t?.selectionStart ?? el.text.length;
    const end = t?.selectionEnd ?? el.text.length;
    api.update(el.id, { text: (el.text.slice(0, start) + token + el.text.slice(end)).slice(0, 160) });
  };
  const familyOf = (f: FontRef): FontKey => (f === "$heading" ? doc.fonts.heading : f === "$body" ? doc.fonts.body : f);
  return (
    <>
      <Section title="Contenu">
        <textarea
          ref={ref}
          className="input min-h-[70px] resize-y text-[14px]"
          value={el.text}
          maxLength={160}
          onChange={(e) => api.update(el.id, { text: e.target.value }, false)}
          onBlur={() => api.commit()}
          aria-label="Texte"
        />
        <div>
          <div className="mb-1.5 text-[12px] text-muted">Insérer une information (mise à jour automatique) :</div>
          <div className="flex flex-wrap gap-1">
            {VARIABLES.map((v) => (
              <button key={v.key} type="button" onClick={() => insert(`{${v.key}}`)} className="rounded-md bg-brand-soft px-2 py-1 text-[11.5px] font-medium text-brand hover:bg-brand/15">
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </Section>
      <Section title="Typographie">
        <select className="input py-2 text-[14px]" value={el.font} onChange={(e) => api.update(el.id, { font: e.target.value as FontRef })} aria-label="Police" style={{ fontFamily: `qrp-${familyOf(el.font)}` }}>
          <option value="$heading">Police des titres · {FONTS[doc.fonts.heading].label}</option>
          <option value="$body">Police des textes · {FONTS[doc.fonts.body].label}</option>
          {FONT_KEYS.map((k) => (
            <option key={k} value={k}>{FONTS[k].label} — {FONTS[k].style}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <IconButton title="Gras" active={el.bold} onClick={() => api.update(el.id, { bold: !el.bold })}><Bold className="h-4 w-4" /></IconButton>
          <IconButton title="Majuscules" active={!!el.uppercase} onClick={() => api.update(el.id, { uppercase: !el.uppercase })}><CaseUpper className="h-4 w-4" /></IconButton>
          <div className="ml-auto">
            <Segmented
              value={el.align}
              onChange={(v) => api.update(el.id, { align: v })}
              options={[
                { value: "left", label: <AlignLeft className="h-3.5 w-3.5" />, title: "Aligner à gauche" },
                { value: "center", label: <AlignCenter className="h-3.5 w-3.5" />, title: "Centrer" },
                { value: "right", label: <AlignRight className="h-3.5 w-3.5" />, title: "Aligner à droite" },
              ]}
            />
          </div>
        </div>
        <div>
          <span className="text-[13px] text-muted">Taille</span>
          <Slider value={el.size} min={1.4} max={12} step={0.1} onChange={(v) => api.update(el.id, { size: v }, false)} onCommit={() => api.commit()} format={(v) => `${Math.round(v * MM_TO_PT)} pt`} />
        </div>
        <div>
          <span className="text-[13px] text-muted">Espacement des lettres</span>
          <Slider value={el.tracking ?? 0} min={-0.05} max={0.4} step={0.01} onChange={(v) => api.update(el.id, { tracking: v }, false)} onCommit={() => api.commit()} format={(v) => `${Math.round(v * 100)}`} />
        </div>
        <Row label="Position verticale">
          <Segmented
            value={el.valign ?? "middle"}
            onChange={(v) => api.update(el.id, { valign: v })}
            options={[
              { value: "top", label: <AlignStartHorizontal className="h-3.5 w-3.5" />, title: "En haut" },
              { value: "middle", label: <AlignCenterHorizontal className="h-3.5 w-3.5" />, title: "Au milieu" },
              { value: "bottom", label: <AlignEndHorizontal className="h-3.5 w-3.5" />, title: "En bas" },
            ]}
          />
        </Row>
        <Row label="Sur une seule ligne">
          <input type="checkbox" checked={el.maxLines === 1} onChange={(e) => api.update(el.id, { maxLines: e.target.checked ? 1 : undefined })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
        </Row>
      </Section>
      <Section title="Couleur">
        <ColorField value={el.color} palette={doc.palette} onChange={(c) => api.update(el.id, { color: c })} />
        <OpacityRow api={api} el={el} />
      </Section>
    </>
  );
}

function ShapeProps({ api, el }: { api: EditorApi; el: ShapeEl }) {
  const pal = api.doc.palette;
  const isLine = el.shape === "line";
  return (
    <>
      {!isLine ? (
        <Section title="Remplissage">
          <ColorField value={el.fill} palette={pal} onChange={(c) => api.update(el.id, { fill: c })} allowNone />
        </Section>
      ) : null}
      <Section title={isLine ? "Trait" : "Contour"}>
        <ColorField value={el.stroke ?? "none"} palette={pal} onChange={(c) => api.update(el.id, { stroke: c, strokeWidth: c !== "none" && !el.strokeWidth ? 0.4 : el.strokeWidth })} allowNone={!isLine} />
        <div>
          <span className="text-[13px] text-muted">Épaisseur</span>
          <Slider value={el.strokeWidth ?? 0} min={0} max={3} step={0.05} onChange={(v) => api.update(el.id, { strokeWidth: v }, false)} onCommit={() => api.commit()} format={(v) => `${v.toFixed(2)} mm`} />
        </div>
        <Row label="Pointillés">
          <input type="checkbox" checked={!!el.dashed} onChange={(e) => api.update(el.id, { dashed: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
        </Row>
      </Section>
      {el.shape === "rect" ? (
        <Section title="Coins">
          <Slider value={el.radius ?? 0} min={0} max={Math.min(el.w, el.h) / 2} step={0.1} onChange={(v) => api.update(el.id, { radius: v }, false)} onCommit={() => api.commit()} format={(v) => `${v.toFixed(1)} mm`} />
        </Section>
      ) : null}
      <Section title="Effet">
        <OpacityRow api={api} el={el} />
      </Section>
    </>
  );
}

function IconProps({ api, el }: { api: EditorApi; el: IconEl }) {
  return (
    <>
      <Section title="Pictogramme">
        <div className="grid max-h-[176px] grid-cols-7 gap-1 overflow-y-auto pr-1">
          {Object.entries(ICONS).map(([key, icon]) => (
            <button key={key} type="button" title={icon.label} aria-label={icon.label} onClick={() => api.update(el.id, { icon: key })} className={clsx("grid aspect-square place-items-center rounded-md transition", el.icon === key ? "bg-brand-soft text-brand ring-1 ring-brand" : "text-ink hover:bg-ink/[0.06]")}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={icon.d} /></svg>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Couleur et trait">
        <ColorField value={el.color} palette={api.doc.palette} onChange={(c) => api.update(el.id, { color: c })} />
        <div>
          <span className="text-[13px] text-muted">Épaisseur du trait</span>
          <Slider value={el.strokeWidth ?? 2} min={1} max={3.5} step={0.25} onChange={(v) => api.update(el.id, { strokeWidth: v }, false)} onCommit={() => api.commit()} format={(v) => v.toFixed(2)} />
        </div>
        <OpacityRow api={api} el={el} />
      </Section>
    </>
  );
}

function GraphicProps({ api, el }: { api: EditorApi; el: GraphicEl }) {
  const g = GRAPHICS[el.graphic];
  const siblings = Object.entries(GRAPHICS).filter(([, x]) => x.group === g?.group);
  return (
    <>
      <Section title={g?.group ?? "Graphisme"}>
        <div className="grid max-h-[168px] grid-cols-5 gap-1.5 overflow-y-auto pr-1">
          {siblings.map(([key, x]) => (
            <button key={key} type="button" title={x.label} aria-label={x.label} onClick={() => api.update(el.id, { graphic: key })} className={clsx("grid aspect-square place-items-center rounded-md p-1 transition", el.graphic === key ? "bg-brand-soft text-brand ring-1 ring-brand" : "text-ink hover:bg-ink/[0.06]")}>
              <GraphicThumb g={x} className="h-full w-full" />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Couleur">
        <ColorField value={el.color} palette={api.doc.palette} onChange={(c) => api.update(el.id, { color: c })} />
        {g?.mode === "stroke" ? (
          <div>
            <span className="text-[13px] text-muted">Épaisseur du trait</span>
            {g.kind === "pattern" ? (
              <Slider value={el.strokeWidth ?? 0.25} min={0.08} max={1.5} step={0.02} onChange={(v) => api.update(el.id, { strokeWidth: v }, false)} onCommit={() => api.commit()} format={(v) => `${v.toFixed(2)} mm`} />
            ) : (
              <Slider value={el.strokeWidth ?? 3} min={1} max={8} step={0.25} onChange={(v) => api.update(el.id, { strokeWidth: v }, false)} onCommit={() => api.commit()} format={(v) => v.toFixed(2)} />
            )}
          </div>
        ) : null}
        {g?.kind === "pattern" ? (
          <div>
            <span className="text-[13px] text-muted">Densité du motif</span>
            <Slider value={el.density ?? 1} min={0.3} max={3} step={0.05} onChange={(v) => api.update(el.id, { density: v }, false)} onCommit={() => api.commit()} format={(v) => `${Math.round(v * 100)} %`} />
          </div>
        ) : null}
        <OpacityRow api={api} el={el} />
      </Section>
    </>
  );
}

function ImageProps({ api, el, onReplace }: { api: EditorApi; el: ImageEl; onReplace: () => void }) {
  return (
    <Section title="Image">
      <button type="button" onClick={onReplace} className="w-full rounded-lg bg-brand-soft py-2 text-[13px] font-semibold text-brand hover:bg-brand/15">Remplacer l&apos;image</button>
      <div>
        <span className="text-[13px] text-muted">Arrondi des coins</span>
        <Slider value={el.radius ?? 0} min={0} max={Math.min(el.w, el.h) / 2} step={0.1} onChange={(v) => api.update(el.id, { radius: v }, false)} onCommit={() => api.commit()} format={(v) => (v >= Math.min(el.w, el.h) / 2 - 0.05 ? "rond" : `${v.toFixed(1)} mm`)} />
      </div>
      <OpacityRow api={api} el={el} />
      <p className="text-[12px] leading-snug text-muted">L&apos;image remplit son cadre (recadrage automatique, sans déformation). Agrandissez le cadre pour en montrer davantage.</p>
    </Section>
  );
}

function QrProps({ api, el }: { api: EditorApi; el: QrEl }) {
  const { w, h } = FORMATS[api.doc.format];
  const max = Math.min(w, h) - 2;
  return (
    <Section title="QR code">
      <div className="flex gap-2.5 rounded-lg bg-success-soft p-3 text-[12.5px] leading-relaxed text-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-success" />
        <span>Toujours noir sur blanc, avec sa marge de sécurité, au premier plan et d&apos;au moins {MIN_QR_MM} mm. Il est relu automatiquement à chaque modification.</span>
      </div>
      <div>
        <span className="text-[13px] text-muted">Taille (marge blanche comprise)</span>
        <Slider
          value={el.w}
          min={MIN_QR_MM}
          max={max}
          step={0.5}
          onChange={(v) => api.update(el.id, { w: v, h: v, x: el.x + (el.w - v) / 2, y: el.y + (el.h - v) / 2 }, false)}
          onCommit={() => api.commit()}
          format={(v) => `${v.toFixed(1)} mm`}
        />
      </div>
      <div>
        <span className="text-[13px] text-muted">Arrondi du cadre blanc</span>
        <Slider value={el.radius ?? 1.2} min={0} max={4} step={0.1} onChange={(v) => api.update(el.id, { radius: v }, false)} onCommit={() => api.commit()} format={(v) => `${v.toFixed(1)} mm`} />
      </div>
    </Section>
  );
}

function Geometry({ api, el }: { api: EditorApi; el: Element }) {
  const { w, h } = FORMATS[api.doc.format];
  const lockedRatio = keepsRatio(el);
  const setW = (v: number) => (lockedRatio ? api.update(el.id, { w: v, h: (el.h / el.w) * v }) : api.update(el.id, { w: v }));
  const setH = (v: number) => (lockedRatio ? api.update(el.id, { h: v, w: (el.w / el.h) * v }) : api.update(el.id, { h: v }));
  const align = (to: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    const m = SAFE_MM;
    const patch = { left: { x: m }, hcenter: { x: (w - el.w) / 2 }, right: { x: w - m - el.w }, top: { y: m }, vcenter: { y: (h - el.h) / 2 }, bottom: { y: h - m - el.h } }[to];
    api.update(el.id, patch);
  };
  return (
    <Section title="Position et taille">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={el.x} onChange={(v) => api.update(el.id, { x: v })} />
        <NumberField label="Y" value={el.y} onChange={(v) => api.update(el.id, { y: v })} />
        <NumberField label="L" value={el.w} min={el.type === "qr" ? MIN_QR_MM : 0.5} onChange={setW} />
        <NumberField label="H" value={el.h} min={el.type === "qr" ? MIN_QR_MM : 0.4} onChange={setH} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-canvas p-1 ring-1 ring-line">
        <IconButton title="Aligner à gauche de l'étiquette" onClick={() => align("left")}><AlignStartVertical className="h-4 w-4" /></IconButton>
        <IconButton title="Centrer horizontalement" onClick={() => align("hcenter")}><AlignCenterVertical className="h-4 w-4" /></IconButton>
        <IconButton title="Aligner à droite de l'étiquette" onClick={() => align("right")}><AlignEndVertical className="h-4 w-4" /></IconButton>
        <IconButton title="Aligner en haut" onClick={() => align("top")}><AlignStartHorizontal className="h-4 w-4" /></IconButton>
        <IconButton title="Centrer verticalement" onClick={() => align("vcenter")}><AlignCenterHorizontal className="h-4 w-4" /></IconButton>
        <IconButton title="Aligner en bas" onClick={() => align("bottom")}><AlignEndHorizontal className="h-4 w-4" /></IconButton>
      </div>
    </Section>
  );
}

function Arrange({ api, el }: { api: EditorApi; el: Element }) {
  return (
    <Section title="Calque">
      <div className="flex flex-wrap gap-1">
        <IconButton title="Premier plan (sous le QR)" onClick={() => api.reorder(el.id, "front")}><BringToFront className="h-4 w-4" /></IconButton>
        <IconButton title="Avancer" onClick={() => api.reorder(el.id, "up")}><ArrowUp className="h-4 w-4" /></IconButton>
        <IconButton title="Reculer" onClick={() => api.reorder(el.id, "down")}><ArrowDown className="h-4 w-4" /></IconButton>
        <IconButton title="Arrière-plan" onClick={() => api.reorder(el.id, "back")}><SendToBack className="h-4 w-4" /></IconButton>
      </div>
    </Section>
  );
}

function LabelSettings({ api, onFormat }: { api: EditorApi; onFormat: (f: FormatKey) => void }) {
  const doc: LabelDoc = api.doc;
  return (
    <div>
      <div className="border-b border-line px-4 py-3 text-[13.5px] font-semibold">Étiquette</div>
      <Section title="Format">
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAT_KEYS.map((f) => (
            <button key={f} type="button" onClick={() => onFormat(f)} aria-pressed={doc.format === f} className={clsx("rounded-lg border px-1 py-2 text-center text-[12.5px] font-semibold transition", doc.format === f ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>
              {FORMATS[f].w}×{FORMATS[f].h}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-snug text-muted">La composition s&apos;adapte automatiquement au nouveau format.</p>
      </Section>
      <Section title="Fond et forme">
        <ColorField value={doc.background} palette={doc.palette} onChange={(c) => api.setDoc({ ...doc, background: c })} />
        <div>
          <span className="text-[13px] text-muted">Coins arrondis (découpe)</span>
          <Slider value={doc.corner} min={0} max={8} step={0.5} onChange={(v) => api.setDoc({ ...doc, corner: v }, false)} onCommit={() => api.commit()} format={(v) => `${v.toFixed(1)} mm`} />
        </div>
      </Section>
      <Section title="Couleurs du design">
        <div className="space-y-2">
          {PALETTE_ROLES.map((r) => (
            <label key={r} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-muted">{ROLE_LABELS[r]}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11.5px] text-faint">{doc.palette[r]}</span>
                <span className="relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: doc.palette[r] }}>
                  <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={doc.palette[r]} aria-label={`Couleur ${ROLE_LABELS[r]}`} onChange={(e) => api.setDoc({ ...doc, palette: { ...doc.palette, [r]: e.target.value.toUpperCase() } }, false)} onBlur={() => api.commit()} />
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-[12px] leading-snug text-muted">Les éléments liés à une couleur de la palette changent tous ensemble.</p>
      </Section>
      <Section title="Polices du design">
        {(["heading", "body"] as const).map((role) => (
          <Row key={role} label={role === "heading" ? "Titres" : "Textes"}>
            <select className="input w-[170px] py-1.5 text-[13.5px]" value={doc.fonts[role]} onChange={(e) => api.setDoc({ ...doc, fonts: { ...doc.fonts, [role]: e.target.value as FontKey } })} style={{ fontFamily: `qrp-${doc.fonts[role]}` }} aria-label={role === "heading" ? "Police des titres" : "Police des textes"}>
              {FONT_KEYS.map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
            </select>
          </Row>
        ))}
      </Section>
    </div>
  );
}
