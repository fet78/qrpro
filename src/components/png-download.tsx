"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { decodeImageData } from "@/lib/labels/verify";
import { buttonClass } from "./ui";

/**
 * Export PNG haute définition (600 dpi) : le SVG vectoriel est rastérisé dans le navigateur,
 * puis le QR est DÉCODÉ dans l'image produite. S'il ne se relit pas exactement, rien n'est téléchargé.
 */
export function PngDownload({ codeId, code, expectedUrl, type = "label", dpi = 600, label }: { codeId: string; code: string; expectedUrl: string; type?: "label" | "qr"; dpi?: number; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/codes/${codeId}/svg?inline=1${type === "qr" ? "&type=qr" : ""}`);
      if (!res.ok) throw new Error(await res.text());
      const svgText = await res.text();
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
      const mm = (v: string | null) => parseFloat(v ?? "0");
      const wMm = mm(doc.getAttribute("width"));
      const hMm = mm(doc.getAttribute("height"));
      const pxW = Math.round((wMm / 25.4) * dpi);
      const pxH = Math.round((hMm / 25.4) * dpi);
      const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Rendu impossible"));
        i.src = blobUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext("2d")!;
      if (type === "qr") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, pxW, pxH);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, pxW, pxH);
      URL.revokeObjectURL(blobUrl);

      // Contrôle : décodage du QR dans l'image finale (réduite, comme vue par un téléphone).
      const check = document.createElement("canvas");
      const s = Math.min(1, 900 / Math.max(pxW, pxH));
      check.width = Math.round(pxW * s);
      check.height = Math.round(pxH * s);
      const cctx = check.getContext("2d")!;
      cctx.fillStyle = "#fff";
      cctx.fillRect(0, 0, check.width, check.height);
      cctx.drawImage(canvas, 0, 0, check.width, check.height);
      const decoded = decodeImageData(cctx.getImageData(0, 0, check.width, check.height));
      if (decoded !== expectedUrl) throw new Error("Le contrôle de lecture du QR a échoué : export annulé.");

      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible"))), "image/png"));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = `${type === "qr" ? "qr" : "etiquette"}-${code}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={run} disabled={busy} className={buttonClass("secondary", "sm")}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {label}
      </button>
      {error ? <span className="mt-1 text-[12px] text-danger">{error}</span> : null}
    </span>
  );
}
