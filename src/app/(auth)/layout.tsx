import { BrandMark } from "@/components/brand";
import { getSettings } from "@/server/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgb(var(--brand)/0.10),transparent_65%)]" />
      <BrandMark name={s.brandName} className="relative mb-8" />
      <div className="relative w-full max-w-[420px] animate-fade-up">{children}</div>
    </div>
  );
}
