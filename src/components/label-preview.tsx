/** Affiche un SVG d'étiquette produit par notre moteur (textes en contours, aucun contenu utilisateur brut). */
export function LabelSvg({ svg, className = "", realWidthMm }: { svg: string; className?: string; realWidthMm?: number }) {
  return (
    <div
      className={`label-svg drop-shadow-[0_10px_24px_rgb(15_23_42/0.18)] ${className}`}
      style={realWidthMm ? { width: `${realWidthMm}mm` } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
