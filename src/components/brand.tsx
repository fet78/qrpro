import Link from "next/link";

/** Logo de la marque : un pictogramme QR stylisé + le nom (configurable dans l'administration). */
export function BrandMark({ name, href = "/", className = "" }: { name: string; href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="rgb(var(--brand))" />
        <rect x="7" y="7" width="7" height="7" rx="1.5" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="18" y="7" width="7" height="7" rx="1.5" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="7" y="18" width="7" height="7" rx="1.5" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="18" y="18" width="3" height="3" fill="#fff" />
        <rect x="22" y="22" width="3" height="3" fill="#fff" />
        <rect x="22" y="18" width="3" height="3" fill="#fff" opacity=".55" />
      </svg>
      <span className="text-[16px]">{name}</span>
    </Link>
  );
}
