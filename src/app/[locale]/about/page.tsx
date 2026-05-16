import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/presentation/components/ui/Logo";
import { Footer } from "@/presentation/components/ui/Footer";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function AboutPage() {
  const t = await getTranslations("about");

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
        <h1 className="text-2xl font-bold text-white mt-6">{t("title")}</h1>
        <p className="text-gray-400 mt-4">Content coming soon.</p>
      </main>
      <Footer />
    </div>
  );
}
