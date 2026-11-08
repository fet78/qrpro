"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadLogo, removeLogo } from "@/app/espace/actions";
import { buttonClass } from "./ui";

/**
 * Le logo est converti en PNG dans le navigateur (≤ 800 px) : le serveur ne reçoit et ne stocke
 * qu'un PNG, qu'il revérifie. Formats acceptés à l'import : PNG, JPG, WebP, SVG.
 */
async function toPng(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image illisible"));
      i.src = url;
    });
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 600;
    const scale = Math.min(1, 800 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(16, Math.round(w * scale));
    canvas.height = Math.max(16, Math.round(h * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoUpload({ current, onChange }: { current: string | null; onChange?: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(current);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setMessage({ ok: false, text: "Formats acceptés : PNG, JPG, WebP ou SVG." });
    if (file.size > 8 * 1024 * 1024) return setMessage({ ok: false, text: "Fichier trop lourd (8 Mo maximum)." });
    start(async () => {
      try {
        const png = await toPng(file);
        const fd = new FormData();
        fd.set("logo", new File([png], "logo.png", { type: "image/png" }));
        const res = await uploadLogo(null, fd);
        setMessage({ ok: !!res?.ok, text: res?.message ?? "" });
        if (res?.ok) {
          const local = URL.createObjectURL(png);
          setPreview(local);
          onChange?.(local);
        }
      } catch {
        setMessage({ ok: false, text: "Cette image n'a pas pu être lue. Essayez un PNG ou un JPG." });
      }
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Logo" className="h-full w-full object-contain p-1" /> : <ImagePlus className="h-5 w-5 text-faint" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => input.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {preview ? "Changer le logo" : "Ajouter un logo"}
          </button>
          {preview ? (
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeLogo();
                  setMessage({ ok: !!res?.ok, text: res?.message ?? "" });
                  setPreview(null);
                  onChange?.(null);
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> Retirer
            </button>
          ) : null}
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <p className="hint">PNG ou JPG, idéalement sur fond transparent ou blanc.</p>
      {message?.text ? <p className={`mt-1.5 text-[12.5px] ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p> : null}
    </div>
  );
}
