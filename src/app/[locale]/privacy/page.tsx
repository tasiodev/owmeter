import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/presentation/components/ui/Logo";
import { Footer } from "@/presentation/components/ui/Footer";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("legalPrivacy");

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4">
        <Link href="/">
          <Logo variant="topbar" />
        </Link>
      </header>
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {t("backHome")}
        </Link>
        <div className="mt-6 mb-10 space-y-1">
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-xs text-gray-500">{t("updated")}</p>
        </div>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s} className="space-y-2">
              <h2 className="text-base font-semibold text-gray-100">{t(`${s}Title`)}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{t(`${s}Body`)}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
